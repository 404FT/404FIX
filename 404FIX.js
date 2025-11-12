// ==UserScript==
// @name         Shikimori 404 Fix
// @namespace    http://tampermonkey.net/
// @version      1.0.5
// @description  Fetch anime info and render 404 pages.
// @author       404FT
// @updateURL    https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.js
// @downloadURL  https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.js
// @match        https://shikimori.one/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Утилиты ---
    const log = (...args) => console.log('[404FIX]', ...args);
    const error = (...args) => console.error('[404FIX]', ...args);

    // --- Rate Limiter (Ограничитель запросов) ---
    const RATE_LIMIT_MS = 200; // 1000ms / 5 RPS = 200ms
    const requestQueue = [];
    let isProcessingQueue = false;

    const processQueue = async () => {
        if (requestQueue.length === 0) {
            isProcessingQueue = false;
            return;
        }
        isProcessingQueue = true;
        const nextRequest = requestQueue.shift();
        try {
            const result = await nextRequest.requestFn();
            nextRequest.resolve(result);
        } catch (e) {
            nextRequest.reject(e);
        }
        setTimeout(processQueue, RATE_LIMIT_MS);
    };

    // --- Модуль API ---
    const apiRequest = (endpoint, isWebEndpoint = false) => {
        return new Promise((resolve, reject) => {
            const requestFn = async () => {
                const url = isWebEndpoint
                    ? `https://shikimori.one${endpoint}`
                    : `https://shikimori.one/api${endpoint}`;
                try {
                    const response = await fetch(url, { headers: { 'User-Agent': 'TampermonkeyScript/1.0.4' } });
                    if (!response.ok) throw new Error(`API request failed: ${response.status} for ${url}`);
                    return await response.json();
                } catch (err) {
                    error(err.message);
                    throw err;
                }
            };
            requestQueue.push({ requestFn, resolve, reject });
            if (!isProcessingQueue) processQueue();
        });
    };

    // --- Модуль получения данных ---

    const getCurrentUser = async () => {
        try {
            const user = await apiRequest('/users/whoami');
            if (!user || !user.id) return null;
            return {
                USER_ID: user.id, USER_NICK: user.nickname, USER_URL: user.url || `https://shikimori.one/${user.nickname}`,
                USER_AVATAR: user.avatar || (user.image?.x48 || ''), USER_AVATAR_X16: user.image?.x16 || '',
                USER_AVATAR_X32: user.image?.x32 || '', USER_AVATAR_X48: user.image?.x48 || '',
                USER_AVATAR_X64: user.image?.x64 || '', USER_AVATAR_X80: user.image?.x80 || '',
                USER_AVATAR_X148: user.image?.x148 || '', USER_AVATAR_X160: user.image?.x160 || ''
            };
        } catch (err) {
            log('Не удалось получить данные пользователя (возможно, не авторизован).', err.message);
            return null;
        }
    };

    const fetchComments = async (topicId, maxComments = 50) => {
        if (!topicId) return [];
        let allComments = [], anchor = null, page = 1, limit = 3, fetched = 0;
        const initialEndpoint = `/comments?commentable_id=${topicId}&commentable_type=Topic&limit=${limit}&order=created_at&order_direction=desc`;
        let comments = await apiRequest(initialEndpoint);
        allComments = allComments.concat(comments);
        fetched += comments.length;
        while (fetched < maxComments && comments.length > 0) {
            anchor = comments[comments.length - 1].id;
            limit = 10;
            const webEndpoint = `/comments/fetch/${anchor}/Topic/${topicId}/${page + 1}/${limit}`;
            comments = await apiRequest(webEndpoint, true);
            allComments = allComments.concat(comments);
            fetched += comments.length;
            page++;
        }
        return allComments.slice(0, maxComments);
    };

    const getAnimePageData = async (id) => {
        log(`📡 Запускаю параллельную загрузку данных для аниме ID: ${id}`);
        const [animeResult, newsResult, externalLinksResult] = await Promise.allSettled([
            apiRequest(`/animes/${id}`),
            apiRequest(`/topics?forum=news&linked_type=Anime&linked_id=${id}&type=Topics::NewsTopic&limit=30&order=comments_count&order_direction=desc`),
            apiRequest(`/animes/${id}/external_links`)
        ]);

        if (animeResult.status === 'rejected') {
            error(`❌ КРИТИЧЕСКАЯ ОШИБКА: не удалось получить основные данные аниме.`, animeResult.reason);
            throw animeResult.reason;
        }

        const anime = animeResult.value;
        const topicId = anime.topic_id || null;
        const comments = await fetchComments(topicId, 50).catch(err => {
            log('⚠️ Не удалось загрузить комментарии:', err.message);
            return [];
        });

        const animeData = {
            INFO: {
                ID: anime.id || 0, RU_NAME: anime.russian || 'N/A', EN_NAME: anime.english?.join(', ') || 'N/A',
                TYPE: anime.kind || 'N/A', EPISODES: anime.episodes || 'N/A', DURATION: anime.duration || 'N/A',
                STATUS: anime.status || 'N/A', GENRES: anime.genres?.map(g => ({ id: g.id, russian: g.russian, name: g.name })) || [],
                RATING: anime.rating || 'N/A', SCORE: anime.score || 'N/A', SOURCE: anime.source || 'N/A',
                STUDIOS: anime.studios?.map(s => ({ id: s.id, name: s.name, image: s.image?.original ? `https://shikimori.one${s.image.original}` : '' })) || [],
                DESCRIPTION: anime.description_html || 'N/A', MYANIMELIST_ID: anime.myanimelist_id || 'N/A', TOPIC_ID: topicId
            },
            POSTER: anime.image ? `https://shikimori.one${anime.image.original}` : 'N/A',
            RATINGS: {
                USER_SCORES: anime.rates_scores_stats?.map(s => ({ score: s.name, count: s.value })) || [],
                USER_STATUS_STATS: anime.rates_statuses_stats?.map(s => ({ status: s.name, count: s.value })) || []
            },
            VIDEOS: {
                SUBTITLES: anime.fansubbers?.map(name => ({ name })) || [],
                DUBBING: anime.fandubbers?.map(name => ({ name })) || []
            },
            COMMENTS: comments.map(c => ({ id: c.id, text_preview: c.body?.substring(0, 100) + '...', user_id: c.user_id, user: c.user?.nickname, created_at: c.created_at })),
            NEWS: newsResult.status === 'fulfilled' ? newsResult.value.map(t => ({ id: t.id, topic_title: t.topic_title, link: `https://shikimori.one/forum/news/${t.id}` })) : [],
            EXTERNAL_LINKS: externalLinksResult.status === 'fulfilled' ? externalLinksResult.value.map(l => ({ url: l.url, site: l.site_name, lang: l.lang })) : []
        };
        log(`✅ Все данные для аниме ID: ${id} успешно обработаны.`);
        return animeData;
    };

    // --- Модуль отрисовки ---
    const renderTemplate = (html, data) => {
        // Замены основных плейсхолдеров
        html = html.replaceAll('{{ID}}', data.INFO.ID || '');
        html = html.replaceAll('{{RU_NAME}}', data.INFO.RU_NAME || 'N/A');
        html = html.replaceAll('{{EN_NAME}}', data.INFO.EN_NAME || 'N/A');
        html = html.replaceAll('{{TYPE}}', data.INFO.TYPE || '?');
        html = html.replaceAll('{{STATUS}}', data.INFO.STATUS || 'N/A');
        html = html.replaceAll('{{SCORE}}', data.INFO.SCORE || 'N/A');
        html = html.replaceAll('{{EPISODES}}', data.INFO.EPISODES || '?');
        html = html.replaceAll('{{DURATION}}', data.INFO.DURATION || '? мин.');
        html = html.replaceAll('{{SOURCE}}', data.INFO.SOURCE || 'Отсутствует');
        html = html.replaceAll('{{POSTER}}', data.POSTER || '');
        html = html.replaceAll('{{DESCRIPTION}}', data.INFO.DESCRIPTION || 'Описание отсутствует');
        html = html.replaceAll('{{MYANIMELIST_ID}}', data.INFO.MYANIMELIST_ID || '');
        html = html.replaceAll('{{COMMENTS_COUNT}}', (Array.isArray(data.COMMENTS) ? data.COMMENTS.length : 0));
        const commentsAnchor = (Array.isArray(data.COMMENTS) && data.COMMENTS.length > 3) ? data.COMMENTS[3].id : 0;
        html = html.replaceAll('{{COMMENTS_ANCHOR}}', commentsAnchor);
        html = html.replaceAll('{{TOPIC_ID}}', data.INFO.TOPIC_ID || '');

        if (data.USER) {
            html = html.replaceAll('{{USER_ID}}', data.USER.USER_ID);
            html = html.replaceAll('{{USER_NICK}}', data.USER.USER_NICK);
            html = html.replaceAll('{{USER_URL}}', data.USER.USER_URL);
            html = html.replaceAll('{{USER_AVATAR}}', data.USER.USER_AVATAR);
            html = html.replaceAll('{{USER_AVATAR_X16}}', data.USER.USER_AVATAR_X16);
            html = html.replaceAll('{{USER_AVATAR_X32}}', data.USER.USER_AVATAR_X32);
            html = html.replaceAll('{{USER_AVATAR_X48}}', data.USER.USER_AVATAR_X48);
            html = html.replaceAll('{{USER_AVATAR_X64}}', data.USER.USER_AVATAR_X64);
            html = html.replaceAll('{{USER_AVATAR_X80}}', data.USER.USER_AVATAR_X80);
            html = html.replaceAll('{{USER_AVATAR_X148}}', data.USER.USER_AVATAR_X148);
            html = html.replaceAll('{{USER_AVATAR_X160}}', data.USER.USER_AVATAR_X160);
        }

        function getRatingTooltip(rating) {
          if (!rating) return "";
          switch (rating) {
            case "g":
              return "G - Для всех возрастов";
            case "pg":
              return "PG - Родителям рекомендуется просмотреть перед детьми";
            case "pg_13":
              return "PG-13 - Детям до 13 лет просмотр не желателен";
            case "r":
              return "R - Лицам до 17 лет обязательно присутствие взрослого";
            case "r+":
              return "R+ - Лицам до 17 лет просмотр запрещён";
            case "rx":
              return "Хентай - смотреть только с родителями";
            default:
              return rating;
          }
        }
        html = html.replaceAll('{{RATING}}', data.INFO.RATING || '');

        function getRatingNotice(score) {
          if (!score) return "Нет оценки";
          if (score >= 10) return "Эпик вин!";
          if (score >= 9) return "Великолепно";
          if (score >= 8) return "Отлично";
          if (score >= 7) return "Хорошо";
          if (score >= 6) return "Нормально";
          if (score >= 5) return "Более-менее";
          if (score >= 4) return "Плохо";
          if (score >= 3) return "Очень плохо";
          if (score >= 2) return "Ужасно";
          if (score >= 1) return "Хуже некуда";
          return "Нет оценки";
        }
        const score = parseFloat(data.INFO.SCORE || 0);
        const scoreRound = Math.round(score);
        html = html.replaceAll('{{SCORE}}', score.toFixed(2));
        html = html.replaceAll('{{SCORE_ROUND}}', scoreRound);
        html = html.replaceAll('{{RATING_NOTICE}}', getRatingNotice(score));
        html = html.replaceAll('{{RATING_TOOLTIP}}', getRatingTooltip(data.INFO.RATING));

        
        html = html.replaceAll(
          "{{STUDIOS}}",
          Array.isArray(data.INFO.STUDIOS)
            ? data.INFO.STUDIOS.map(
                (studio) =>
                  `<a href="https://shikimori.one/animes/studio/${
                    studio.id
                  }-${encodeURIComponent(studio.name)}" title="Аниме студии ${
                    studio.name
                  }"><img alt="Аниме студии ${
                    studio.name
                  }" class="studio-logo" src="${studio.image || ""}" /></a>`
              ).join("\n")
            : ""
        );
        
        function renderGenres(genres) {
          if (!Array.isArray(genres) || genres.length === 0) return "";
          return (
            `<div class='key'>Жанры:</div><div class='value'>` +
            genres
              .map((g) => {
                const en = g.name || "";
                const ru = g.russian || en;
                const id = g.id || "";
                const href = `https://shikimori.one/animes/genre/${id}-${en}`;
                return `<a class="b-tag bubbled" href="${href}"><span class='genre-en'>${en}</span><span class='genre-ru'>${ru}</span></a>`;
              })
              .join("\n") +
            `</div>`
          );
        }
        html = html.replaceAll('{{GENRES}}', renderGenres(data.INFO.GENRES));
        
        function renderUserRatingsHTML(userScores) {
          if (!Array.isArray(userScores) || userScores.length === 0) return "";
          const statsArray = userScores.map((item) => [
            String(item.score),
            item.count,
          ]);
          const dataStats = JSON.stringify(statsArray).replace(/"/g, "&quot;");
          return `<div class="block"><div class="subheadline">Оценки людей</div><div data-bar="horizontal" data-stats="${dataStats}" id="rates_scores_stats"></div></div>`;
        }
        html = html.replaceAll('{{USER_RATINGS}}', renderUserRatingsHTML(data.RATINGS.USER_SCORES));
        
        function renderUserStatusesHTML(userStatuses) {
          if (!Array.isArray(userStatuses) || userStatuses.length === 0)
            return "";
          const statusNames = {
            planned: "Запланировано",
            watching: "Смотрю",
            completed: "Просмотрено",
            dropped: "Брошено",
            on_hold: "Отложено",
          };
          const statusMap = {
            Запланировано: "planned",
            Смотрю: "watching",
            Просмотрено: "completed",
            Брошено: "dropped",
            Отложено: "on_hold",
          };
          const statsArray = userStatuses.map((item) => [
            statusMap[item.status] || item.status.toLowerCase(),
            item.count,
          ]);
          const total = userStatuses.reduce((sum, item) => sum + item.count, 0);
          return `<div class="block"><div class="subheadline">В списках у людей</div><div data-bar="horizontal" data-entry_type="anime" data-stats="${JSON.stringify(
            statsArray
          ).replace(
            /"/g,
            "&quot;"
          )}" id="rates_statuses_stats"></div><div class="total-rates">В списках у ${total} человек</div></div>`;
        }
        html = html.replaceAll('{{USER_STATUSES}}', renderUserStatusesHTML(data.RATINGS.USER_STATUS_STATS));
        
        function renderDubbing(dubbing) {
          if (!Array.isArray(dubbing) || dubbing.length === 0) return "";
          const visible = dubbing
            .slice(0, 5)
            .map(
              (d) =>
                `<div class="b-menu-line" title="${d.name}">${d.name}</div>`
            )
            .join("\n");
          const hidden = dubbing
            .slice(5)
            .map(
              (d) =>
                `<div class="b-menu-line" title="${d.name}">${d.name}</div>`
            )
            .join("\n");
          if (!hidden) return visible;
          return `${visible}<div class="b-show_more unprocessed">+ показать всех</div><div class="b-show_more-more" style="display:none;">${hidden}<div class="hide-more">&mdash; спрятать</div></div>`;
        }
        html = html.replaceAll('{{DUBBING}}', renderDubbing(data.VIDEOS.DUBBING));
        
        function renderSubtitles(subtitles) {
          if (!Array.isArray(subtitles) || subtitles.length === 0) return "";
          return subtitles
            .map(
              (s) =>
                `<div class="b-menu-line" title="${s.name}">${s.name}</div>`
            )
            .join("\n");
        }
        html = html.replaceAll('{{SUBTITLES}}', renderSubtitles(data.VIDEOS.SUBTITLES));
        
        function renderNewsHTML(newsArray) {
          if (!Array.isArray(newsArray) || newsArray.length === 0) return "";
          return `<div class="b-menu-links menu-topics-block history m30"><div class="subheadline m5">Новости</div><div class="block">${newsArray
            .map(
              (n) =>
                `<a class="b-menu-line entry b-link" href="${n.link}" style="display:block; margin:4px 0;"><span class="name">${n.topic_title}</span></a>`
            )
            .join("\n")}</div></div>`;
        }
        html = html.replaceAll('{{NEWS}}', renderNewsHTML(data.NEWS));
        
        html = html.replaceAll('{{COMMENTS}}', data.COMMENTS?.map(c => `${c.user || 'Anon'}: ${c.text_preview}`).join('\n') || '');
        
        function renderExternalLinks(links) {
          if (!Array.isArray(links) || links.length === 0) return "";
          return links
            .map((l) => {
              const url = l.url || "#";
              let siteName, siteClass;
              if (l.site) {
                siteName = l.site;
                siteClass = l.site.toLowerCase().replace(/\s/g, "_");
              } else if (url !== "#" && url.startsWith("http")) {
                try {
                  const hostname = new URL(url).hostname;
                  siteName = hostname;
                  siteClass = hostname.toLowerCase().replace(/\s/g, "_");
                } catch (e) {
                  siteName = "Unknown";
                  siteClass = "unknown";
                }
              } else {
                siteName = "Unknown";
                siteClass = "unknown";
              }
              return `<div class="b-external_link ${siteClass} b-menu-line"><div class="linkeable b-link" data-href="${url}">${siteName}</div></div>`;
            })
            .join("\n");
        }
        html = html.replaceAll('{{EXTERNAL_LINKS}}', renderExternalLinks(data.EXTERNAL_LINKS));

        return html;
    };

    // --- Основная логика ---
    const renderPageForAnime = async (animeId) => {
        const startTime = performance.now();
        try {
            const templateUrl = 'https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.html';
            const [pageData, currentUser, htmlText] = await Promise.all([
                getAnimePageData(animeId),
                getCurrentUser(),
                fetch(templateUrl).then(res => res.text())
            ]);
            if (currentUser) pageData.USER = currentUser;
            const renderedHTML = renderTemplate(htmlText, pageData);
            
            /* В будущем эти 3 строки могут сломаться */
            document.open();
            document.write(renderedHTML);
            document.close();
            
            // --- Если сломается, меняйте на это ---
            /*
            // Парсим HTML и извлекаем ТОЛЬКО BODY
            const parser = new DOMParser();
            const doc = parser.parseFromString(fullRenderedHTML, 'text/html');
            const newBody = doc.body;

            // Заменяем существующий body на новый, сохраняя head
            document.body.innerHTML = newBody.innerHTML;
            
            // Копируем атрибуты из нового body в существующий
            for (const attr of newBody.attributes) {
                document.body.setAttribute(attr.name, attr.value);
            }
            */
        } catch (e) {
            error(`Ошибка при рендере страницы для аниме ID ${animeId}:`, e.message);
        } finally {
            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);
            log(`✅ Страница полностью отрисована за ${duration} мс.`);
        }
    };

    window.restoreAnimePage = async (animeId) => {
        const startTime = performance.now();
        log(`🔄 Ручное восстановление аниме ID: ${animeId}`);
        await renderPageForAnime(animeId);
        const script = document.createElement('script');
        script.src = '/packs/js/application.js';
        script.onload = () => log('📊 Графики инициализированы');
        script.onerror = () => error('Не удалось загрузить скрипт для графиков.');
        document.head.appendChild(script);
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        log(`✅ Ручное восстановление завершено за ${duration} мс (включая загрузку доп. скрипта).`);
    };

    const init = () => {
        if (document.title.trim() !== '404') return;
        const match = location.pathname.match(/\/animes\/(\d+)/);
        if (!match) return;
        const animeId = match[1];
        renderPageForAnime(animeId);
    };

    init();

})();