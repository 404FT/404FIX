// ==UserScript==
// @name         Shikimori 404 Fix
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Fetch anime info and render 404 pages.
// @author       404FT
// @updateURL    https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.js
// @downloadURL  https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.js
// @match        https://shikimori.one/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    
    // --- Утилиты ---
    
    const CONFIG = {
      DEBUG_MODE: false, // Включает/выключает подробные логи в консоли
      RATE_LIMIT_MS: 200, // Интервал между запросами к API (1000ms / 5 RPS = 200ms)
      RELATED_VISIBLE_COUNT: 5, // Сколько связанных произведений показывать сразу
      SIMILAR_LIMIT: 7, // Сколько похожих аниме показывать
      COMMENTS_LIMIT: 50, // Макс. кол-во загружаемых комментариев
      USER_AGENT: 'TampermonkeyScript/1.3', // User-Agent для запросов
      TEMPLATE_URL: 'https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.html'
    };
    
    let loaderInterval;
    const showLoader = () => {
        const h1 = document.querySelector('.dialog h1');
        const p = document.querySelector('.dialog p');
        if (h1 && p) {
            h1.textContent = 'Загрузка данных...';
            p.innerHTML = 'Пожалуйста, подождите. Время: <span id="loader-timer">0.0</span> c.';
            const startTime = Date.now();
            const timerSpan = document.getElementById('loader-timer');
            loaderInterval = setInterval(() => {
                if (timerSpan) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    timerSpan.textContent = elapsed;
                }
            }, 100);
        }
    };
    
    const hideLoader = () => {
        clearInterval(loaderInterval);
        log('Страница загружена, отображаем...');
    };
    
    /**
     * @description Искусственно вызывает события загрузки страницы, чтобы "оживить" JS-компоненты Shikimori.
     */
    const triggerPageLoadEvents = () => {
        log('⚡️ Вызываю события загрузки страницы (turbolinks:load)...');
        // Основное событие для Turbolinks
        document.dispatchEvent(new Event('turbolinks:load'));
        // Дополнительное стандартное событие на всякий случай
        document.dispatchEvent(new Event('DOMContentLoaded'));
    };
    
    const log = (...args) => console.log('[404FIX]', ...args);
    const debug = (...args) => CONFIG.DEBUG_MODE && console.log('[404FIX]', ...args);
    const error = (...args) => console.error('[404FIX]', ...args);

    // --- Rate Limiter (Ограничитель запросов) ---
    // const RATE_LIMIT_MS = 200; // 1000ms / 5 RPS = 200ms
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
        setTimeout(processQueue, CONFIG.RATE_LIMIT_MS);
    };

    // --- Модуль API ---
    const apiRequest = (endpoint, isWebEndpoint = false) => {
        return new Promise((resolve, reject) => {
            const requestFn = async () => {
                const url = isWebEndpoint
                    ? `https://shikimori.one${endpoint}`
                    : `https://shikimori.one/api${endpoint}`;
                try {
                    const response = await fetch(url, { headers: { 'User-Agent': CONFIG.USER_AGENT } });
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
    
    /**
     * @description Получает ID стиля пользователя, а затем сам CSS.
     * @param {number} userId - ID текущего пользователя.
     * @returns {Promise<string|null>} Скомпилированный CSS или null в случае ошибки/отсутствия.
     */
    const getUserStyle = async (userId) => {
        if (!userId) return null;

        try {
            log(`🎨 Запрашиваю данные пользователя ${userId} для получения ID стиля...`);
            const userData = await apiRequest(`/users/${userId}`);
            const styleId = userData?.style_id;

            if (styleId) {
                log(`🎨 ID стиля найден: ${styleId}. Запрашиваю CSS...`);
                const styleData = await apiRequest(`/styles/${styleId}`);
                const compiledCss = styleData?.compiled_css;

                if (compiledCss) {
                    log(`🎨 Пользовательский CSS успешно получен.`);
                    return compiledCss;
                } else {
                    log(`🎨 Стиль ${styleId} не содержит скомпилированного CSS.`);
                    return null;
                }
            } else {
                log(`🎨 У пользователя ${userId} не установлен кастомный стиль.`);
                return null;
            }
        } catch (err) {
            error('❌ Ошибка при получении пользовательского стиля:', err.message);
            return null; // Возвращаем null, чтобы не прерывать выполнение скрипта
        }
    };
    
    /**
     * @description Загружает "донорскую" страницу, чтобы извлечь из неё свежий CSRF-токен.
     * @returns {Promise<string|null>} CSRF-токен или null в случае ошибки.
     */
    const getCsrfToken = async () => {
        try {
            log('🔄 Запрашиваю страницу-донор для CSRF-токена...');
            /**
             * Для тестов на скорость загрузки
             * https://shikimori.one/animes/1-cowboy-bebop
             * https://shikimori.one/animes/62616-sheng-dan-chuanqi-zhu-gong-de-shaizi
             */
            const url = 'https://shikimori.one/animes/62616-sheng-dan-chuanqi-zhu-gong-de-shaizi'; // Любая живая страница
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`[404FIX] Статус ответа: ${response.status}`);
            }
            const pageHtml = await response.text();

            // Используем DOMParser, чтобы безопасно найти элемент, не вставляя его в DOM
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageHtml, 'text/html');
            const tokenElement = doc.querySelector('meta[name="csrf-token"]');

            if (tokenElement) {
                const token = tokenElement.getAttribute('content');
                log('🔄 CSRF-токен успешно извлечён.');
                return token;
            } else {
                throw new Error('Мета-тег csrf-token не найден на странице-доноре.');
            }
        } catch (err) {
            error('❌ Ошибка при получении CSRF-токена:', err.message);
            return null; // Важно вернуть null, чтобы не сломать остальной скрипт
        }
    };
    
    const fetchComments = async (topicId, maxComments = CONFIG.COMMENTS_LIMIT) => {
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
    
    const getSimilarAnimes = async (id) => {
        try {
            const data = await apiRequest(`/animes/${id}/similar`);
            return Array.isArray(data) ? data.slice(0, 12) : []; // лимит 12
        } catch (err) {
            log('Не удалось загрузить похожие аниме:', err.message);
            return [];
        }
    };
    
    /**
     * @description Получает список связанных произведений с уже включенной информацией.
     * @param {number} id - ID основного аниме.
     * @returns {Promise<Array>} Массив объектов связанных произведений.
     */
    const getRelated = async (id) => {
        try {
            log('🔗 Запрашиваю связанные произведения...');
            const relatedList = await apiRequest(`/animes/${id}/related`);
            if (!Array.isArray(relatedList) || relatedList.length === 0) {
                log('🔗 Связанные произведения не найдены.');
                return [];
            }
            log(`🔗 Успешно получено ${relatedList.length} связанных произведений.`);
            return relatedList;
        } catch (err) {
            error('❌ Ошибка при получении связанных произведений:', err.message);
            return [];
        }
    };
    
    /**
     * @description Получает и сортирует роли (персонажей и команду) для аниме.
     * @param {number} id - ID аниме.
     * @returns {Promise<Object>} Объект с тремя массивами: main, supporting, staff.
     */
    const getRoles = async (id) => {
        const MISSING_IMAGE_URL = 'https://shikimori.one/assets/globals/missing_preview.jpg';
        const rolesData = {
            main: [],
            supporting: [],
            staff: []
        };

        try {
            log('👥 Запрашиваю роли...');
            const allRoles = await apiRequest(`/animes/${id}/roles`);
            if (!Array.isArray(allRoles) || allRoles.length === 0) {
                log('👥 Роли не найдены.');
                return rolesData;
            }

            for (const role of allRoles) {
                // Если есть character - это персонаж
                if (role.character) {
                    // Проверяем, есть ли у изображения заглушка
                    if (role.character.image?.original?.includes('missing_original')) {
                        role.character.image.preview = MISSING_IMAGE_URL;
                        role.character.image.x96 = MISSING_IMAGE_URL;
                    }
                    if (role.roles.includes('Main')) {
                        rolesData.main.push(role);
                    } else if (role.roles.includes('Supporting')) {
                        rolesData.supporting.push(role);
                    }
                }
                // Если есть person - это член команды
                else if (role.person) {
                     if (role.person.image?.original?.includes('missing_original')) {
                        role.person.image.preview = MISSING_IMAGE_URL;
                        role.person.image.x96 = MISSING_IMAGE_URL;
                    }
                    rolesData.staff.push(role);
                }
            }
            log(`👥 Роли успешно отсортированы: ${rolesData.main.length} главных, ${rolesData.supporting.length} второстепенных, ${rolesData.staff.length} из команды.`);
            return rolesData;
        } catch (err) {
            error('❌ Ошибка при получении ролей:', err.message);
            return rolesData; // Возвращаем пустую структуру в случае ошибки
        }
    };
    
    const getAnimePageData = async (id) => {
        log(`📡 Запускаю параллельную загрузку данных для аниме ID: ${id}`);
        const [animeResult, newsResult, externalLinksResult, similarResult, relatedResult, rolesResult] = await Promise.allSettled([
            apiRequest(`/animes/${id}`),
            apiRequest(`/topics?forum=news&linked_type=Anime&linked_id=${id}&type=Topics::NewsTopic&limit=30&order=comments_count&order_direction=desc`),
            apiRequest(`/animes/${id}/external_links`),
            apiRequest(`/animes/${id}/similar`),
            getRelated(id),
            getRoles(id)
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
        const similarAnimes = similarResult.status === 'fulfilled' ? similarResult.value.slice(0, 12) : [];

        const animeData = {
            INFO: {
                ID: anime.id || 0, RU_NAME: anime.russian || 'N/A', EN_NAME: anime.english?.join(', ') || 'N/A',
                TYPE: anime.kind || 'N/A', EPISODES: anime.episodes || 'N/A', DURATION: anime.duration || 'N/A',
                STATUS: anime.status || 'N/A', GENRES: anime.genres?.map(g => ({ id: g.id, russian: g.russian, name: g.name })) || [],
                RATING: anime.rating || 'N/A', SCORE: anime.score || 'N/A', SOURCE: anime.source || 'N/A',
                STUDIOS: anime.studios?.map(s => ({ id: s.id, name: s.name, image: s.image?.original ? `https://shikimori.one${s.image.original}` : '' })) || [],
                DESCRIPTION: anime.description_html || 'N/A',
                MYANIMELIST_ID: anime.myanimelist_id || 'N/A',
                TOPIC_ID: topicId
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
            EXTERNAL_LINKS: externalLinksResult.status === 'fulfilled' ? externalLinksResult.value.map(l => ({ url: l.url, site: l.site_name, lang: l.lang })) : [],
            SIMILAR_ANIMES: similarAnimes,
            RELATED: relatedResult.status === 'fulfilled' ? relatedResult.value : [],
            ROLES: rolesResult.status === 'fulfilled' ? rolesResult.value : { main: [], supporting: [], staff: [] }
        };
        log(`✅ Все данные для аниме ID: ${id} успешно обработаны.`);
        debug(animeData);
        return animeData;
    };
    
    // --- Модуль отрисовки ---
    
    /**
    * @description Рендерит блок связанных произведений.
    * @param {Array} relatedData - Массив объектов из /api/animes/:id/related.
    * @param {Object} currentUser - Объект текущего пользователя.
    * @returns {string} Готовый HTML-блок.
    */
    const renderRelatedBlock = (relatedData, currentUser) => {
      if (!Array.isArray(relatedData) || relatedData.length === 0) {
          return '<div class="cc" style="text-align: center; padding: 20px; color: #666; font-style: italic;">Нет информации о связанных произведениях.</div>';
      }

      const visibleCount = CONFIG.RELATED_VISIBLE_COUNT;
      const visibleItems = relatedData.slice(0, visibleCount);
      const hiddenItems = relatedData.slice(visibleCount);

      const renderItem = (item) => {
          const entry = item.anime || item.manga;
          if (!entry) return '';

          const type = item.anime ? 'anime' : 'manga';
          const typePascalCase = type.charAt(0).toUpperCase() + type.slice(1);
          const typePlural = entry.url.startsWith('/ranobe') ? 'ranobe' : (type === 'anime' ? 'animes' : 'mangas');
          const url = `https://shikimori.one${entry.url}`;
          const relationText = item.relation_russian;

          const image = entry.image?.preview ? `https://shikimori.one${entry.image.preview}` : 'https://shikimori.one/assets/globals/missing_mini.png';
          const image2x = entry.image?.x96 ? `https://shikimori.one${entry.image.x96}` : image;

          const kindText = entry.kind.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const year = entry.aired_on?.split('-')[0] || entry.released_on?.split('-')[0] || '';
          
          const dataEntry = JSON.stringify({
              id: entry.id,
              episodes: entry.episodes || null,
              chapters: entry.chapters || null,
              volumes: entry.volumes || null
          }).replace(/"/g, '&quot;');

          const userRateModel = JSON.stringify({
              id: null, user_id: null, target_id: entry.id, score: 0, status: "planned",
              episodes: entry.episodes || 0,
              chapters: entry.chapters || 0,
              volumes: entry.volumes || 0,
              created_at: null, updated_at: null, target_type: typePascalCase,
              text: null, rewatches: 0
          }).replace(/"/g, '&quot;');
          
          const userIdInput = currentUser ? `<input type="hidden" name="user_rate[user_id]" value="${currentUser.USER_ID}">` : '';
          const statusText = type === 'anime' ? 'Просмотрено' : 'Прочитано';
          const rewatchingText = type === 'anime' ? 'Пересматриваю' : 'Перечитываю';
          const watchingText = type === 'anime' ? 'Смотрю' : 'Читаю';

          return `
          <div class="b-db_entry-variant-list_item" data-id="${entry.id}" data-text="${entry.name}" data-type="${type}" data-url="${url}">
              <a class="image bubbled" href="${url}">
                  <picture><source srcset="${image}, ${image2x} 2x" type="image/webp"><img alt="${entry.russian || entry.name}" src="${image}" srcset="${image2x} 2x"></picture>
              </a>
              <div class="info">
                  <div class="name">
                      <a class="b-link bubbled" href="${url}">
                          <span class="name-en">${entry.name}</span>
                          <span class="name-ru">${entry.russian || entry.name}</span>
                      </a>
                  </div>
                  <div class="line">
                      <div class="value">
                          <a class="b-tag" href="https://shikimori.one/${typePlural}/kind/${entry.kind}">${kindText}</a>
                          ${year ? `<a class="b-tag" href="https://shikimori.one/${typePlural}/season/${year}">${year} год</a>` : ''}
                          <div class="b-anime_status_tag other">${relationText}</div>
                      </div>
                  </div>
                  <div class="user_rate-container">
                      <div class="b-user_rate ${type}-${entry.id}"
                          data-dynamic="user_rate"
                          data-entry="${dataEntry}"
                          data-extended="false"
                          data-model="${userRateModel}"
                          data-target_id="${entry.id}"
                          data-target_type="${typePascalCase}"
                          data-track_user_rate="user_rate:${type}:${entry.id}">
                          <div>
                            <div class="b-add_to_list planned">
                              <form action="/api/v2/user_rates" data-method="POST" data-remote="true" data-type="json">
                                <input type="hidden" name="frontend" value="1">
                                ${userIdInput}
                                <input type="hidden" name="user_rate[target_id]" value="${entry.id}">
                                <input type="hidden" name="user_rate[target_type]" value="${typePascalCase}">
                                <input type="hidden" name="user_rate[status]" value="planned"><input type="hidden" name="user_rate[score]" value="0">
                                <div class="trigger">
                                  <div class="trigger-arrow"></div>
                                  <div class="text add-trigger" data-status="planned">
                                    <div class="plus"></div><span class="status-name" data-text="Добавить в список"></span>
                                  </div>
                                </div>
                                <div class="expanded-options">
                                  <div class="option add-trigger" data-status="completed"><div class="text"><span class="status-name" data-text="${statusText}"></span></div></div>
                                  <div class="option add-trigger" data-status="dropped"><div class="text"><span class="status-name" data-text="Брошено"></span></div></div>
                                  <div class="option add-trigger" data-status="on_hold"><div class="text"><span class="status-name" data-text="Отложено"></span></div></div>
                                  <div class="option add-trigger" data-status="planned"><div class="text"><span class="status-name" data-text="Запланировано"></span></div></div>
                                  <div class="option add-trigger" data-status="rewatching"><div class="text"><span class="status-name" data-text="${rewatchingText}"></span></div></div>
                                  <div class="option add-trigger" data-status="watching"><div class="text"><span class="status-name" data-text="${watchingText}"></span></div></div>
                                </div>
                              </form>
                            </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>`;
      };

      let html = `<div class="cc">${visibleItems.map(renderItem).join('')}</div>`;

      if (hiddenItems.length > 0) {
          html += `<div class="b-show_more unprocessed">+ показать остальное (${hiddenItems.length})</div>`;
          html += `<div class="b-show_more-more" style="display: none;">${hiddenItems.map(renderItem).join('')}<div class="hide-more">— спрятать</div></div>`;
      }

      return html;
    };
    
    const renderTemplate = (html, data) => {
      // Вставка пользовательского CSS, если он есть
      if (data.USER_CSS) {
          html = html.replace(
              '<style id="custom_css" type="text/css"></style>',
              `<style id="custom_css" type="text/css">${data.USER_CSS}</style>`
          );
      }
      
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
      const commentsAnchor = (Array.isArray(data.COMMENTS) && data.COMMENTS.length > 0) ? data.COMMENTS[0].id : 0;
      html = html.replaceAll('{{COMMENTS_ANCHOR}}', commentsAnchor);
      html = html.replaceAll('{{TOPIC_ID}}', data.INFO.TOPIC_ID || '');
      html = html.replaceAll('{{AUTHENTICITY_TOKEN}}', data.CSRF_TOKEN || '');
      html = html.replaceAll('{{RELATED_CONTENT}}', renderRelatedBlock(data.RELATED, data.USER));
      
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
      
      function renderSimilarAnimes(animes) {
          if (!Array.isArray(animes) || animes.length === 0) return '';
          return animes.slice(0, CONFIG.SIMILAR_LIMIT).map(anime => {
              const id = anime.id;
              const kind = anime.kind === 'tv' ? 'anime' : (anime.kind || 'anime');
              const url = `https://shikimori.one/animes/${id}`;
              const nameEn = anime.name || '';
              const nameRu = anime.russian || nameEn;
              const airedOn = anime.aired_on?.split('-')?.[0] || '';

              // ВЫБИРАЕМ ОПТИМАЛЬНОЕ ИЗОБРАЖЕНИЕ:
              // x96 или preview - идеальны для превью. Original - слишком большой и медленный.
              const imagePath = anime.image?.x96 || anime.image?.preview || anime.image?.original || '';
              
              if (!imagePath) {
                  return ''; // Пропускаем аниме без изображения
              }

              const imageUrl = `https://shikimori.one${imagePath}`;

              const imageHtml = `
                  <picture style="display: block; width: 93px; height: 132px;">
                      <source srcset="${imageUrl} 1x, ${imageUrl} 2x" type="image/jpeg">
                      <img alt="${nameRu}"
                          src="${imageUrl}"
                          srcset="${imageUrl} 2x"
                          style="width: 93px; height: 132px; object-fit: cover; display: block;">
                  </picture>
              `;

              return `
                <article class="c-column b-catalog_entry c-${kind} entry-${id}"
                        data-track_user_rate="catalog_entry:${kind}:${id}"
                        id="${id}"
                        itemscope
                        itemtype="http://schema.org/Movie"
                        style="width: 93px; height: auto; float: left; margin: 5px; overflow: hidden;">
                  <a class="cover bubbled"
                    data-delay="150"
                    data-tooltip_url="https://shikimori.one/animes/${id}/tooltip"
                    href="${url}"
                    style="display: block; width: 93px; text-decoration: none;">
                    <span class="image-decor" style="display: block; width: 93px; height: 132px; overflow: hidden;">
                      <span class="image-cutter" style="display: block; width: 93px; height: 132px;">
                        ${imageHtml}
                      </span>
                    </span>
                    <span class="title two_lined" itemprop="name" style="display: block; width: 93px; font-size: 12px; line-height: 1.2; margin-top: 5px; word-wrap: break-word;">
                      <span class="name-en" style="display: block; font-weight: bold;">${nameEn}</span>
                      <span class="name-ru" style="display: block; color: #666;">${nameRu}</span>
                    </span>
                    <span class="misc" style="display: block; width: 93px; font-size: 11px; color: #999;">${airedOn}</span>
                  </a>
                  <meta content="https://shikimori.one${anime.image?.original || ''}" itemprop="image">
                  <meta content="https://shikimori.one${anime.image?.x48 || ''}" itemprop="thumbnailUrl">
                  <meta content="${airedOn}" itemprop="dateCreated">
                </article>`.trim();
          }).join('');
      }
      
      function renderSimilarAnimesBlock(animes) {
          const limited = animes.slice(0, 7);
          const entries = renderSimilarAnimes(limited);
          return entries ? `<div class="cc cc-similar">${entries}</div>` : '';
      }
      // === Похожие аниме ===
      if (data.SIMILAR_ANIMES && Array.isArray(data.SIMILAR_ANIMES)) {
          html = html.replace('{{SIMILAR_ANIMES}}', renderSimilarAnimesBlock(data.SIMILAR_ANIMES));
      } else {
          html = html.replace('{{SIMILAR_ANIMES}}', '');
      }
      
      /**
      * @description Рендерит HTML-блок для главных персонажей.
      * @param {Array} mainCharacters - Массив главных персонажей из getRoles.
      * @returns {string} Готовый HTML-блок.
      */
      const renderMainCharacters = (mainCharacters) => {
        if (!Array.isArray(mainCharacters) || mainCharacters.length === 0) {
            return '<div class="cc m0" style="text-align: center; padding: 20px; color: #666; font-style: italic;">Нет информации о главных героях.</div>';
        }

        const charactersHtml = mainCharacters.map(role => {
          const char = role.character;
          if (!char) return '';

          const url = `https://shikimori.one${char.url}`;
          const imagePreview = char.image?.preview ? `https://shikimori.one${char.image.preview}` : 'https://shikimori.one/assets/globals/missing_preview.jpg';
          const imageX96 = char.image?.x96 ? `https://shikimori.one${char.image.x96}` : imagePreview;

          return `
            <article class="c-column b-catalog_entry c-character entry-${char.id}" id="${char.id}" itemscope itemtype="http://schema.org/Person">
                <meta content="https://shikimori.one${char.image.original}" itemprop="image">
                <meta content="https://shikimori.one${char.image.x48}" itemprop="thumbnailUrl">
                <a class="cover bubbled" data-delay="150" data-tooltip_url="/characters/${char.id}/tooltip" href="${url}">
                    <span class="image-decor">
                        <span class="image-cutter">
                            <picture>
                                <source srcset="${imagePreview}, ${imageX96} 2x" type="image/webp">
                                <img alt="${char.russian || char.name}" src="${imagePreview}" srcset="${imageX96} 2x">
                            </picture>
                        </span>
                    </span>
                    <span class="title two_lined" itemprop="name">
                        <span class="name-en">${char.name}</span>
                        <span class="name-ru">${char.russian || char.name}</span>
                    </span>
                </a>
            </article>
          `;
        }).join('');

        return `<div class="cc m0">${charactersHtml}</div>`;
      };
      html = html.replaceAll('{{MAIN_CHARACTERS}}', renderMainCharacters(data.ROLES.main));
      
      function renderStaffBlock(staff) {
        if (!Array.isArray(staff) || staff.length === 0) {
            return '<div class="cc" style="text-align:center;padding:20px;color:#666;font-style:italic;">Нет информации о команде.</div>';
        }

        // 1) Таблица важности ролей (ближе к Shikimori)
        const ROLE_PRIORITY = {
            "Original Creator": 1,
            "Story": 1,
            "Script": 1,

            "Director": 2,
            "Series Composition": 2,
            "Episode Director": 3,
            "Storyboard": 3,

            "Chief Animation Director": 4,
            "Animation Director": 5,
            "Character Design": 5,

            "Chief Producer": 6,
            "Producer": 7,

            "Key Animation": 8,
            "2nd Key Animation": 9,
            "In-Between Animation": 10
        };

        // 2) Функция определения важности человека
        function getPersonPriority(role) {
            return Math.min(
                ...role.roles.map(r => ROLE_PRIORITY[r] || 999)
            );
        }

        // 3) Сортировка staff по важности
        const sortedStaff = staff
            .slice() // копия массива
            .sort((a, b) => getPersonPriority(a) - getPersonPriority(b))
            .slice(0, 5); // максимум 5 человек

        // 4) Рендер
        return `
          <div class="cc">
              ${sortedStaff.map(role => {
                  const p = role.person;
                  const id = p.id;
                  const url = `https://shikimori.one${p.url}`;

                  const imgPreview = p.image?.preview
                      ? `https://shikimori.one${p.image.preview}`
                      : '/assets/globals/missing/mini.png';

                  const img2x = p.image?.x96
                      ? `https://shikimori.one${p.image.x96}`
                      : '/assets/globals/missing/mini@2x.png';
                  
                  const img4x = p.image?.x48
                      ? `https://shikimori.one${p.image.x48}`
                      : '/assets/globals/missing/mini@4x.png';
                  
                  const roleTags = role.roles
                      .map(r => `<div class="b-tag">${r}</div>`)
                      .join('');

                  return `
                      <div class="b-db_entry-variant-list_item"
                          data-id="${id}" data-text="${p.russian || p.name}"
                          data-type="person" data-url="${url}">
                          <a class="image bubbled" href="${url}">
                              <picture>
                                  <img src="${img4x}" srcset="${img2x} 2x" alt="${p.russian || p.name}">
                              </picture>
                          </a>
                          <div class="info">
                              <div class="name">
                                  <a class="b-link bubbled" href="${url}">
                                      <span class="name-en">${p.name}</span>
                                      <span class="name-ru">${p.russian || p.name}</span>
                                  </a>
                              </div>
                              <div class="line multiline">
                                  <div class="key">${role.roles.length > 1 ? 'Роли:' : 'Роль:'}</div>
                                  <div class="value">${roleTags}</div>
                              </div>
                          </div>
                      </div>
                  `;
              }).join('')}
          </div>
        `;
      }
      html = html.replace('{{STAFF}}', renderStaffBlock(data.ROLES.staff));
      
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
        if (!Array.isArray(userStatuses) || userStatuses.length === 0) return "";
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
            (s) => `<div class="b-menu-line" title="${s.name}">${s.name}</div>`
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
    let renderPageForAnime = async (animeId) => {
        const startTime = performance.now();
        try {
            const templateUrl = CONFIG.TEMPLATE_URL;

            const [pageData, currentUser, htmlText, csrfToken] = await Promise.all([
                getAnimePageData(animeId),
                getCurrentUser(),
                fetch(templateUrl).then(res => res.text()),
                getCsrfToken()
            ]);

            pageData.CSRF_TOKEN = csrfToken;

            if (currentUser) {
                pageData.USER = currentUser;
                pageData.USER_CSS = await getUserStyle(currentUser.USER_ID);
            } else {
                pageData.USER_CSS = null;
            }

            const renderedHTML = renderTemplate(htmlText, pageData);
            hideLoader();

            document.open();
            document.write(renderedHTML);
            document.close();

        } catch (e) {
            error(`Ошибка при рендере страницы для аниме ID ${animeId}:`, e);
            console.error(e);
        } finally {
            const duration = (performance.now() - startTime).toFixed(2);
            log(`Страница отрисована за ${duration} мс`);
        }
    };

    // === Поддержка кнопки "Ответить" ===
    const setupReplyButtons = () => {
        const textarea = document.querySelector('textarea[name="comment[body]"]');
        if (!textarea) {
            log('Редактор не найден — кнопка Ответить не будет работать');
            return false;
        }

        document.addEventListener('click', e => {


            const btn = e.target.closest('.item-reply');
            if (!btn) return;

            const comment = btn.closest('.b-comment');
            if (!comment) return;

            const commentId = comment.id.replace('comment-', '') || comment.dataset.track_comment;
            const userId = comment.dataset.user_id;
            const nickname = comment.dataset.user_nickname ||
                            comment.querySelector('.name a')?.textContent.trim() ||
                            'анон';

            if (!commentId || !userId) return;

            e.preventDefault();

            const tag = `[comment=${commentId};${userId}]`;
            const val = textarea.value;
            const insert = val && !val.endsWith('\n') ? '\n' + tag : tag;

            textarea.value = val + insert;
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Кнопка "назад"
            const back = document.querySelector('.return-to-reply');
            if (back) {
                back.style.visibility = 'visible';
                back.textContent = `к @${nickname}`;
                back.onclick = () => {
                    comment.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };
            }

            // Визуальный отклик
            btn.style.opacity = '0.5';
            setTimeout(() => btn.style.opacity = '', 200);
        });

        log('Кнопка «Ответить» активирована');
        return true;
    };

    // === Перехватываем renderPageForAnime и добавляем инициализацию reply ===
    const originalRender = renderPageForAnime;
    renderPageForAnime = async function(animeId) {
        await originalRender(animeId);

        // Даем DOM обновиться
        setTimeout(() => {
            setupReplyButtons();
        }, 150);
    };

    // === Ручное восстановление (для отладки) ===
    window.restoreAnimePage = async (animeId) => {
        log(`Ручное восстановление аниме ${animeId}`);
        showLoader();
        await renderPageForAnime(animeId);
    };

    // === Автозапуск ===
    const init = () => {
        if (document.title.trim() !== '404') return;
        const match = location.pathname.match(/\/animes\/(\d+)/);
        if (!match) return;

        showLoader();
        renderPageForAnime(match[1]);
    };

    init();

})();
