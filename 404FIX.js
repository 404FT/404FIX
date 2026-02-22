// ==UserScript==
// @name         Shikimori 404 Fix
// @namespace    http://tampermonkey.net/
// @version      2.2.1
// @description  Fetch anime info and render 404 pages.
// @author       404FT
// @updateURL    https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.js
// @downloadURL  https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.js
// @match        https://shikimori.one/*
// @match        https://shikimori.io/*
// @match        https://shiki.one/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
	"use strict";

	// === ------------ ===
	// === Конфигурация ===
	// === ------------ ===

	const CONFIG = {
		DEBUG_MODE: true, // Включает/выключает подробные логи в консоли
		SITE_NAME: window.location.origin,
		DOMAIN_NAME: window.location.hostname, // Вернет "shiki.one"
		RATE_LIMIT_MS: 200, // Интервал между запросами к API (1000ms / 5 RPS = 200ms)
		RELATED_VISIBLE_COUNT: 5, // Сколько связанных произведений показывать сразу
		SIMILAR_LIMIT: 7, // Сколько похожих аниме показывать
		COMMENTS_LIMIT: 50, // Макс. кол-во загружаемых комментариев
		/*
		 * Заготовка для выбора как получать скрипты, руками каждый
		 * или получить их с донорской страницы
		 */
		// LOAD_SHIKI_SCRIPTS: true,
		USER_AGENT: "TampermonkeyScript/2.1", // User-Agent для запросов
		TEMPLATE_URL:
			"https://raw.githubusercontent.com/404FT/404FIX/refs/heads/main/404FIX.html",
		DONOR_URL: "/animes/62616-sheng-dan-chuanqi-zhu-gong-de-shaizi",
	};

	// ANIME
	const GRAPHQL_QUERY_ANIME_MAIN = `
    query($id: String!) {
      animes(ids: $id, limit: 1, censored: false) {
        id malId name russian english kind score status episodes duration descriptionHtml
        topic { id }
        poster { id originalUrl mainUrl miniAltUrl }
        genres { id name russian kind }
        studios { id name imageUrl }
        scoresStats { score count }
        statusesStats { status count }

        fandubbers
        fansubbers

        videos { id url name kind playerUrl imageUrl }
        screenshots { id originalUrl x166Url x332Url }
        externalLinks { id kind url }
      }
    }`;

	const GRAPHQL_QUERY_ANIME_DETAILS = `
    query($id: String!) {
      animes(ids: $id, limit: 1, censored: false) {
        id
        personRoles {
          id rolesRu rolesEn
          person { id name russian url image: poster { id mainUrl originalUrl miniAltUrl } }
        }
        characterRoles {
          id rolesRu rolesEn
          character { id name russian url image: poster { id mainUrl originalUrl miniAltUrl } }
        }
        related {
          id relationKind relationText
          anime { id name russian kind url episodes airedOn { year } poster { id mainUrl originalUrl miniAltUrl } }
          manga { id name russian kind url volumes chapters airedOn { year } poster { id mainUrl originalUrl miniAltUrl } }
        }
      }
    }`;

	// MANGA
	const GRAPHQL_QUERY_MANGA_MAIN = `
    query($id: String!) {
      mangas(ids: $id, limit: 1, censored: false) {
        id malId name russian english kind score status volumes chapters descriptionHtml
        topic { id }
        poster { id originalUrl mainUrl miniAltUrl }
        genres { id name russian kind }
        publishers { id name }
        scoresStats { score count }
        statusesStats { status count }
        externalLinks { id kind url }
      }
    }`;

	const GRAPHQL_QUERY_MANGA_DETAILS = `
    query($id: String!) {
      mangas(ids: $id, limit: 1, censored: false) {
        id
        personRoles {
          id rolesRu rolesEn
          person { id name russian url image: poster { id mainUrl originalUrl miniAltUrl } }
        }
        characterRoles {
          id rolesRu rolesEn
          character { id name russian url image: poster { id mainUrl originalUrl miniAltUrl } }
        }
        related {
          id relationKind relationText
          anime { id name russian kind url episodes airedOn { year } poster { id mainUrl originalUrl miniAltUrl } }
          manga { id name russian kind url volumes chapters airedOn { year } poster { id mainUrl originalUrl miniAltUrl } }
        }
      }
    }`;

	const ANIME_HTML_TEMPLATE = `
    <!DOCTYPE html> <html data-color-mode="light"> <head> <meta charset="utf-8" /> <meta content="IE=edge,chrome=1" http-equiv="X-UA-Compatible" /> <meta content="width=device-width, initial-scale=1.0" name="viewport" /> <link href="/favicon.ico" rel="icon" type="image/x-icon" /> <link href="/favicons/favicon-16x16.png" rel="icon" sizes="16x16" type="image/png" /> <link href="/favicons/favicon-32x32.png" rel="icon" sizes="32x32" type="image/png" /> <link href="/favicons/favicon-96x96.png" rel="icon" sizes="96x96" type="image/png" /> <link href="/favicons/favicon-192x192.png" rel="icon" sizes="192x192" type="image/png" /> <link href="/favicons/manifest.json" rel="manifest" /> <link href="/favicons/apple-touch-icon-57x57.png" rel="apple-touch-icon" sizes="57x57" /> <link href="/favicons/apple-touch-icon-60x60.png" rel="apple-touch-icon" sizes="60x60" /> <link href="/favicons/apple-touch-icon-72x72.png" rel="apple-touch-icon" sizes="72x72" /> <link href="/favicons/apple-touch-icon-76x76.png" rel="apple-touch-icon" sizes="76x76" /> <link href="/favicons/apple-touch-icon-114x114.png" rel="apple-touch-icon" sizes="114x114" /> <link href="/favicons/apple-touch-icon-120x120.png" rel="apple-touch-icon" sizes="120x120" /> <link href="/favicons/apple-touch-icon-144x144.png" rel="apple-touch-icon" sizes="144x144" /> <link href="/favicons/apple-touch-icon-152x152.png" rel="apple-touch-icon" sizes="152x152" /> <link href="/favicons/apple-touch-icon-180x180.png" rel="apple-touch-icon" sizes="180x180" /> <link color="#123" href="/favicons/safari-pinned-tab.svg" rel="mask-icon" /> <meta content="#000000" name="theme-color" /> <meta content="#000000" name="msapplication-TileColor" /> <meta content="/favicons/ms-icon-144x144.png" name="msapplication-TileImage" /> <meta content="/favicons/browserconfig.xml" name="msapplication-config" /> <link href="/favicons/opera-icon-228x228.png" rel="icon" sizes="228x228" /> <link href="/search.xml" rel="search" title="{{DOMAIN_NAME}}" type="application/opensearchdescription+xml" /> <link href="https://fonts.googleapis.com" rel="preconnect" /> <link href="https://fonts.gstatic.com" rel="preconnect" /> <link href="https://fonts.googleapis.com" rel="preconnect" /> <link href="https://fonts.gstatic.com" rel="preconnect" /> <link href="https://dere.{{DOMAIN_NAME}}" rel="preconnect" /> <meta content="video.tv_show" property="og:type" /> <meta content="{{EN_NAME}}" property="og:title" /> <meta content="http://cdn.anime-recommend.ru/previews/{{MYANIMELIST_ID}}.jpg" property="og:image" /> <meta content="image/jpeg" property="og:image:type" /> <meta content="1200" property="og:image:width" /> <meta content="630" property="og:image:height" /> <meta content="{{SITE_NAME}}/animes/{{ID}}" property="og:url" /> <meta content="Шикимори" property="og:site_name" /> <meta content="1440" property="video:duration" /> <meta content="2024-03-22" property="video:release_date" /> <meta content="Приключения" property="video:tag" /> <meta content="Драма" property="video:tag" /> <meta content="Фэнтези" property="video:tag" /> <meta content="Сёнен" property="video:tag" /> <meta content="summary_large_image" property="twitter:card" /> <meta content="{{EN_NAME}}" name="twitter:title" /> <meta content="http://cdn.anime-recommend.ru/previews/{{MYANIMELIST_ID}}.jpg" name="twitter:image" /> <meta content="Шикимори" name="twitter:site" /> <title>{{EN_NAME}} / Аниме</title> <meta name="csrf-param" content="authenticity_token" /> <meta name="csrf-token" content="{{AUTHENTICITY_TOKEN}}" /> <script nomodule="" src="/outdated-browser.js"></script> {{FETCHED_CSS}} {{FETCHED_JS}} <script> document.addEventListener('DOMContentLoaded', function() { // для совместимости счётчиков с турболинками $(document).on('turbolinks:before-visit', function() { window.turbolinks_referer = location.href; console.log("turbolinks_referer was linked successfully!"); }); }); </script> </head> <body class="p-animes p-animes-show p-db_entries p-db_entries-show x1200" data-camo_url="https://camo-v3.{{DOMAIN_NAME}}/" data-env="production" data-faye="[&quot;/private-{{USER_ID}}&quot;]" data-faye_url="https://faye-v2.{{DOMAIN_NAME}}/" data-js_export_supervisor_keys="[&quot;user_rates&quot;,&quot;topics&quot;,&quot;comments&quot;,&quot;polls&quot;]" data-locale="ru" data-localized_genres="ru" data-localized_names="ru" data-server_time="2025-11-03T17:53:43+03:00" data-user="{&quot;id&quot;:{{USER_ID}},&quot;url&quot;:&quot;https://{{DOMAIN_NAME}}/{{USER_NICK}}&quot;,&quot;is_moderator&quot;:false,&quot;ignored_topics&quot;:[],&quot;ignored_users&quot;:[],&quot;is_day_registered&quot;:true,&quot;is_week_registered&quot;:true,&quot;is_comments_auto_collapsed&quot;:true,&quot;is_comments_auto_loaded&quot;:true}" id="animes_show"> <style id="custom_css" type="text/css"></style> <div id="outdated"></div> <header class="l-top_menu-v2"> <div class="menu-logo"> <a class="logo-container" href="{{SITE_NAME}}" title="Шикимори"> <div class="glyph"></div> <div class="logo"></div> </a> <div class="menu-dropdown main"> <span class="menu-icon trigger mobile" tabindex="-1"></span> <span class="submenu-triangle icon-{{CONTENT_TYPE}}" tabindex="0"> <span>{{SECTION_NAME}}</span> </span> <div class="submenu"> <div class="legend">База данных</div> <a class="icon-anime" href="/animes" tabindex="-1" title="Аниме">Аниме</a> <a class="icon-manga" href="/mangas" tabindex="-1" title="Манга">Манга</a> <a class="icon-ranobe" href="/ranobe" tabindex="-1" title="Ранобэ">Ранобэ</a> <div class="legend">Сообщество</div> <a class="icon-forum" href="/forum" tabindex="-1" title="Форум">Форум</a> <a class="icon-clubs" href="/clubs" tabindex="-1" title="Клубы">Клубы</a> <a class="icon-collections" href="/collections" tabindex="-1" title="Коллекции">Коллекции</a> <a class="icon-critiques" href="/forum/critiques" tabindex="-1" title="Рецензии">Рецензии</a> <a class="icon-articles" href="/articles" tabindex="-1" title="Статьи">Статьи</a> <a class="icon-users" href="/users" tabindex="-1" title="Пользователи">Пользователи</a> <div class="legend">Разное</div> <a class="icon-contests" href="/contests" tabindex="-1" title="Турниры">Турниры</a> <a class="icon-calendar" href="/ongoings" tabindex="-1" title="Календарь">Календарь</a> <div class="legend">Информация</div> <a class="icon-info" href="/about" tabindex="-1" title="О сайте">О сайте</a> <a class="icon-socials" href="/forum/site/270099-my-v-sotsialnyh-setyah" tabindex="-1" title="Мы в соц. сетях">Мы в соц. сетях</a> <a class="icon-moderation" href="/moderations" tabindex="-1" title="Модерация">Модерация</a> </div> </div> </div> <div class="menu-icon search mobile"></div> <div class="global-search" data-autocomplete_anime_url="/animes/autocomplete/v2" data-autocomplete_character_url="/characters/autocomplete/v2" data-autocomplete_manga_url="/mangas/autocomplete/v2" data-autocomplete_person_url="/people/autocomplete/v2" data-autocomplete_ranobe_url="/ranobe/autocomplete/v2" data-default-mode="{{CONTENT_TYPE}}" data-search_anime_url="/animes" data-search_character_url="/characters" data-search_manga_url="/mangas" data-search_person_url="/people" data-search_ranobe_url="/ranobe"> <label class="field"> <input placeholder="Поиск..." type="text" /> <span class="clear" tabindex="-1"></span> <span class="hotkey-marker"></span> <span class="search-marker"></span> </label> <div class="search-results"> <div class="inner"></div> </div> </div> <a class="menu-icon forum desktop" href="/forum" title="Форум"></a> <a class="menu-icon contest" data-count="?" href="/contests/current" title="Текущий турнир"></a> <div class="menu-dropdown profile"> <span tabindex="0"> <a class="submenu-triangle" href="/{{USER_NICK}}"> <img alt="{{USER_NICK}}" src="{{USER_AVATAR_X48}}" srcset="{{USER_AVATAR_X80}} 2x" title="{{USER_NICK}}" /> <span class="nickname">{{USER_NICK}}</span> </a> </span> <div class="submenu"> <div class="legend">Аккаунт</div> <a class="icon-profile" href="/{{USER_NICK}}" tabindex="-1" title="Профиль"> <span class="text">Профиль</span> </a> <a class="icon-anime_list" href="/{{USER_NICK}}/list/anime" tabindex="-1" title="Список аниме"> <span class="text">Список аниме</span> </a> <a class="icon-manga_list" href="/{{USER_NICK}}/list/manga" tabindex="-1" title="Список манги"> <span class="text">Список манги</span> </a> <a class="icon-mail" href="/{{USER_NICK}}/dialogs" tabindex="-1" title="Почта"> <span class="text">Почта</span> </a> <a class="icon-achievements" href="/{{USER_NICK}}/achievements" tabindex="-1" title="Достижения"> <span class="text">Достижения</span> </a> <a class="icon-clubs" href="/{{USER_NICK}}/clubs" tabindex="-1" title="Клубы"> <span class="text">Клубы</span> </a> <a class="icon-settings" href="/{{USER_NICK}}/edit/account" tabindex="-1" title="Настройки"> <span class="text">Настройки</span> </a> <div class="legend">Сайт</div> <a class="icon-site_rules" href="/forum/site/588641-pravila-sayta-v2" tabindex="-1" title="Правила сайта"> <span class="text">Правила сайта</span> </a> <a class="icon-faq" href="/clubs/1093-faq-chasto-zadavaemye-voprosy" tabindex="-1" title="FAQ"> <span class="text">FAQ</span> </a> <a class="icon-sign_out" data-method="delete" href="/users/sign_out" tabindex="-1">Выход</a> </div> </div> </header> <section class="l-page" itemscope="" itemtype="http://schema.org/Movie"> <div> <div class="menu-toggler"> <div class="toggler"></div> </div> <header class="head"> <meta content="Sousou no Frieren" itemprop="name" /> <h1>{{RU_NAME}} <span class="b-separator inline">/</span> {{EN_NAME}} </h1> <div class="b-breadcrumbs" itemscope="" itemtype="https://schema.org/BreadcrumbList"> <span itemprop="itemListElement" itemscope="" itemtype="https://schema.org/ListItem"> <a class="b-link" href="/animes" itemprop="item" title="Аниме"> <span itemprop="name">Аниме</span> </a> <meta content="0" itemprop="position" /> </span> <span itemprop="itemListElement" itemscope="" itemtype="https://schema.org/ListItem"> <a class="b-link" href="/animes/kind/tv" itemprop="item" title="Сериалы"> <span itemprop="name">Сериалы</span> </a> <meta content="1" itemprop="position" /> </span> <span itemprop="itemListElement" itemscope="" itemtype="https://schema.org/ListItem"> <a class="b-link" href="/animes?genre=27-Shounen" itemprop="item" title="Сёнен"> <span itemprop="name">Сёнен</span> </a> <meta content="2" itemprop="position" /> </span> </div> </header> <div class="menu-slide-outer x199"> <div class="menu-slide-inner"> <div class="l-content"> <div class="block"> <meta content="/animes/{{ID}}" itemprop="url" /> <meta content="Sousou no Frieren" itemprop="headline" /> <meta content="Провожающая в последний путь Фрирен" itemprop="alternativeHeadline" /> <meta content="2023-09-29" itemprop="dateCreated" /> <div class="b-db_entry"> <div class="c-image"> <div class="cc block"> <div class="c-poster"> <div class="b-db_entry-poster b-image unprocessed" data-href="{{POSTER}}" data-poster_id="0"> <meta content="{{POSTER}}" itemprop="image" /> <picture> <source srcset="{{POSTER}} 1x, {{POSTER}} 2x" type="image/webp" /> <img alt="{{RU_NAME}}" height="318" src="{{POSTER}}" srcset="{{POSTER}} 2x" width="225" /> </picture> <span class="marker"> <span class="marker-text">705x995</span> </span> </div> </div> <div class="c-actions"> <div class="b-subposter-actions"> <a class="b-subposter-action new_comment b-tooltipped unprocessed to-process" data-direction="top" data-dynamic="day_registered" data-text="Комментировать" title="Комментировать"></a> <a class="b-subposter-action new_review b-tooltipped unprocessed to-process" data-direction="top" data-dynamic="day_registered" data-text="Написать отзыв" href="/animes/{{ID}}/reviews/new" title="Написать отзыв"></a> <a class="b-subposter-action new_critique b-tooltipped unprocessed to-process" data-direction="top" data-dynamic="week_registered" data-text="Написать рецензию" href="/{{CONTENT_TYPE_M}}/{{ID}}/critiques/new?critique%5Btarget_id%5D={{ID}}&amp;critique%5Btarget_type%5D={{CONTENT_TYPE_UP}}&amp;critique%5Buser_id%5D={{USER_ID}}" title="Написать рецензию"></a> <a class="b-subposter-action fav-add b-tooltipped unprocessed to-process" data-add_text="Добавить в избранное" data-direction="top" data-dynamic="authorized" data-kind="" data-remote="true" data-remove_text="Удалить из избранного" data-type="json" href="/api/favorites/{{CONTENT_TYPE_UP}}/{{ID}}"></a> <a class="b-subposter-action edit b-tooltipped unprocessed to-process" data-direction="top" data-dynamic="authorized" data-text="Редактировать" href="/{{CONTENT_TYPE_M}}/{{ID}}/edit" title="Редактировать"></a> </div> </div> </div> {{USER_RATE_BUTTON}} </div> <div class="c-about"> <div class="cc"> <div class="c-info-left"> <div class="subheadline">Информация</div> <div class="block"> <div class="b-entry-info"> <div class='line-container'> <div class='line'> <div class='key'>Тип:</div> <div class='value'>{{TYPE}}</div> </div> </div> <div class='line-container'> <div class='line'> <div class='key'>{{COUNT_LABEL}}:</div> <div class='value'>{{COUNT_VALUE}}</div> </div> </div> <div class='line-container'> <div class='line'> {{DURATION_BLOCK}} </div> </div> <div class='line-container'> <div class='line'> <div class='key'>Статус:</div> <div class='value'> <span class="b-anime_status_tag released" data-text="{{STATUS}}"></span> &nbsp; <span class="b-tooltipped dotted mobile unprocessed" data-direction="right" title="С 29 сентября 2023 г. по 22 марта 2024 г.">в 2023-2024 гг.</span> </div> </div> </div> <div class='line-container'> <div class='line'> {{GENRES}} </div> </div> <div class='line-container'> <div class='line'> <div class='key'>Рейтинг:</div> <div class='value'> <span class="b-tooltipped dotted mobile unprocessed" data-direction="right" title="{{RATING_TOOLTIP}}">{{RATING}}</span> </div> </div> </div> <div class='line-container'> <div class='line'> <div class='key'>Первоисточник:</div> <div class='value'>{{SOURCE}}</div> </div> </div> <div class='line-container'> <div class='line'> <div class='key'>Альтернативные названия:</div> <div class='value'> <span class="other-names to-process" data-clickloaded-url="/{{CONTENT_TYPE_M}}/{{ID}}/other_names" data-dynamic="clickloaded"> <span>···</span> </span> </div> </div> </div> <div class="additional-links"> <div class="line-container"> <div class="key">У аниме:</div> <span class="linkeable" data-href="/{{CONTENT_TYPE_M}}/{{ID}}/critiques">--- рецензия</span> <span class="linkeable" data-href="/{{CONTENT_TYPE_M}}/{{ID}}/reviews">--- отзывов</span> <span class="linkeable" data-href="/forum/animanga/anime-{{ID}}/{{TOPIC_ID}}-obsuzhdenie-anime">{{COMMENTS_COUNT}} комментариев</span> <span class="linkeable" data-href="/{{CONTENT_TYPE_M}}/{{ID}}/coub">---</span> </div> </div> </div> </div> </div> <div class="c-info-right"> <div class="block" itemprop="aggregateRating" itemscope itemtype="http://schema.org/AggregateRating"> <div class="subheadline m5">Рейтинг</div> <div class="scores"> <meta content="10" itemprop="bestRating" /> <meta content="{{SCORE}}" itemprop="ratingValue" /> <meta content="{{RATING_COUNT}}" itemprop="ratingCount" /> <div class="b-rate"> <div class="stars-container"> <div class="hoverable-trigger"></div> <div class="stars score score-{{SCORE_ROUND}}"></div> <div class="stars hover"></div> <div class="stars background"></div> </div> <div class="text-score"> <div class="score-value score-{{SCORE_ROUND}}">{{SCORE}}</div> <div class="score-notice">{{RATING_NOTICE}}</div> </div> </div> </div> </div> <div class="block contest_winners"> </div> <style> .studio-list { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; } </style> <div class="block"> <div class="subheadline">{{ORG_LABEL}}</div> <div class="studio-list"> {{ORGANIZATIONS}} </div> </div> </div> </div> </div> <div class="c-description"> <div class="subheadline m5">Описание</div> <div class="block"> <div class="b-lang_trigger" data-eng="eng" data-rus="рус"> <span>eng</span> </div> <div class="description-other" style="display: none"> <div class="text"> <div class="b-text_with_paragraphs">В разработке.</div> </div> <div class="b-source"> <div class="source"> <div class="key">Источник:</div> <div class="val"> <a class='b-link' href="http://myanimelist.net/anime/{{MYANIMELIST_ID}}">myanimelist.net</a> </div> </div> </div> </div> <div class="description-current"> <div class="text" itemprop="description"> <div class="b-text_with_paragraphs">{{DESCRIPTION}}</div> </div> <div class="b-source"> <div class="contributors"> <div class="key">Автор:</div> <div class="b-user16"> <span>Неизвестно</span> </div> </div> </div> </div> </div> </div> </div> <div class="cc-related-authors"> <div class="c-column block_m"> <div class="b-options-floated mobile-phone"> <span class="linkeable" data-href="/animes/{{ID}}/related">Напрямую</span> <span class="linkeable" data-href="/animes/{{ID}}/chronology">Хронология</span> <span class="linkeable" data-href="/animes/{{ID}}/franchise">Франшиза</span> </div> <div class="subheadline">Связанное</div> {{RELATED_CONTENT}} </div> <div class="c-column c-authors block_m"> <div class="subheadline"> <span class="linkeable" data-href="/animes/{{ID}}/staff">Авторы</span> </div> {{STAFF}} </div> </div> <div class="cc-characters"> <div class="c-characters m0"> <div class="subheadline"> <span class="linkeable" data-href="/animes/{{ID}}/characters">Главные герои</span> </div> {{MAIN_CHARACTERS}} </div> {{SUPPORTING_CHARACTERS}} </div> {{SCREENSHOTS_AND_VIDEOS}} <div class="block"> <div class="subheadline"> <span class="linkeable" data-href="/animes/{{ID}}/similar">Похожее</span> </div> {{SIMILAR_ANIMES}} </div> <div class="subheadline"> <a href="/forum/animanga/anime-{{ID}}/{{TOPIC_ID}}-obsuzhdenie-anime" title="Все комментарии"> Комментарии <div class="count">{{COMMENTS_COUNT}}</div> </a> </div> </div> <div class="to-process" data-dynamic="topic" data-faye="[&quot;/topic-{{TOPIC_ID}}&quot;]"> <div class="b-comments"> <div class="comments-hider">Скрыть {{COMMENTS_COUNT}} комментариев</div> <div class="comments-expander">Показать {{COMMENTS_COUNT}} комментариев</div> <div class="comments-collapser hidden">свернуть</div> <div class="comments-loader to-process" data-clickloaded-url-template="/comments/fetch/{{COMMENTS_ANCHOR}}/Topic/{{TOPIC_ID}}/SKIP/10" data-count="37726" data-dynamic="clickloaded" data-limit="10" data-skip="0">Загрузить ещё 10 из {{COMMENTS_COUNT}} комментариев</div> </div> </div> <div class="editor-container"> <div class="b-options-floated"> <span class="action return-to-reply">назад</span> </div> <div class="subheadline">Твой комментарий</div> <form class="simple_form b-form new_comment" data-type="json" novalidate="novalidate" action="/api/comments" accept-charset="UTF-8" data-remote="true" method="post" > <input type="hidden" name="authenticity_token" value="{{AUTHENTICITY_TOKEN}}" autocomplete="off" /> <input name="frontend" type="hidden" value="true" /> <div class="b-input hidden comment_commentable_id"> <input class="hidden" autocomplete="off" type="hidden" value="{{TOPIC_ID}}" name="comment[commentable_id]" /> </div> <div class="b-input hidden comment_commentable_type"> <input class="hidden" autocomplete="off" type="hidden" value="Topic" name="comment[commentable_type]" /> </div> <div class="b-input hidden comment_is_offtopic"> <input class="hidden" autocomplete="off" type="hidden" value="false" name="comment[is_offtopic]" /> </div> <div class="b-shiki_editor shiki_editor-selector" data-dynamic="shiki_editor" data-field_name="comment[body]" > <div class="controls"> <aside class="buttons"> <div class="editor-controls"> <span class="editor-bold b-tooltipped" data-direction="top" original-title="Жирный" ></span> <span class="editor-italic b-tooltipped" data-direction="top" original-title="Курсив" ></span> <span class="editor-underline b-tooltipped" data-direction="top" original-title="Подчёркнутый" ></span> <span class="editor-strike b-tooltipped" data-direction="top" original-title="Зачёркнутый" ></span> <span class="editor-link b-tooltipped" data-direction="top" original-title="Ссылка" ></span> <span class="editor-image b-tooltipped" data-direction="top" original-title="Ссылка на картинку" ></span> <span class="editor-quote b-tooltipped" data-direction="top" original-title="Цитата" ></span> <span class="editor-spoiler b-tooltipped" data-direction="top" original-title="Спойлер" ></span> <label class="editor-file b-tooltipped" data-direction="top" original-title="Загрузить изображение" > <input type="file" /> </label> <span class="editor-smiley b-tooltipped" data-direction="top" original-title="Смайлик" ></span> </div> </aside> <aside class="markers"> <div class="b-offtopic_marker active off" data-text="оффтоп"></div> </aside> </div> <div class="smileys hidden" data-href="/comments/smileys" > <div class="ajax-loading" title="Загрузка..."></div> </div> <div class="links hidden hidden-block"> <label> <input type="radio" name="link_type" value="url" data-placeholder="Укажи адрес страницы..." /> <span>ссылка</span> </label> <label> <input type="radio" name="link_type" value="anime" data-placeholder="Укажи название аниме..." data-autocomplete="/animes/autocomplete" /> <span>аниме</span> </label> <label> <input type="radio" name="link_type" value="manga" data-placeholder="Укажи название манги..." data-autocomplete="/mangas/autocomplete" /> <span>манга</span> </label> <label> <input type="radio" name="link_type" value="ranobe" data-placeholder="Укажи название ранобэ..." data-autocomplete="/ranobe/autocomplete" /> <span>ранобэ</span> </label> <label> <input type="radio" name="link_type" value="character" data-placeholder="Укажи имя персонажа..." data-autocomplete="/characters/autocomplete" /> <span>персонаж</span> </label> <label> <input type="radio" name="link_type" value="person" data-placeholder="Укажи имя человека..." data-autocomplete="/people/autocomplete" /> <span>человек</span> </label> <div class="input-container"> <input type="text" name="link_value" value="" class="link-value ac_input" autocomplete="off" /> <div class="b-button ok" data-type="links">OK</div> </div> </div> <div class="images hidden hidden-block"> <span>Вставка изображения:</span> <div class="input-container"> <input type="text" name="image_value" value="" class="link-value" placeholder="Укажи адрес картинки..." /> <div class="b-button ok" data-type="images">OK</div> </div> </div> <div class="quotes hidden hidden-block"> <span>Цитирование пользователя:</span> <div class="input-container"> <input type="text" name="quote_value" value="" class="link-value ac_input" placeholder="Укажи имя пользователя..." data-autocomplete="/users/autocomplete" autocomplete="off" /> <div class="b-button ok" data-type="quotes">OK</div> </div> </div> <div class="b-upload_progress"> <div class="bar"></div> </div> <div class="body"> <div class="editor"> <div class="b-input text required comment_body"> <label class="text required control-label"> <abbr title="Обязательное поле">*</abbr> Текст </label> <textarea class="text required editor-area pastable" placeholder="Текст комментария" tabindex="0" data-upload_url="/api/user_images?linked_type=Comment" data-item_type="comment" name="comment[body]" ></textarea> </div> </div> <div class="preview"></div> </div> <footer> <input type="submit" name="commit" value="Написать" id="submit_907900.5100256373" class="btn-primary btn-submit btn" data-disable-with="Отправка…" autocomplete="off" tabindex="0" /> <div class="unpreview" tabindex="0">Вернуться к редактированию</div> <div class="b-button preview" data-preview_url="/comments/preview" tabindex="0" > Предпросмотр </div> <div class="hide">Скрыть</div> <div class="about-bb_codes"> <a href="/bb_codes" target="_blaNK" >примеры BBCode</a > </div> </footer> </div> </form> </div> </div> <aside class="l-menu"> <div class="b-animes-menu"> {{USER_RATINGS}} {{USER_STATUSES}} <div class="block"> <div class="subheadline m5">У друзей</div> </div> <div class="b-favoured"> <div class="subheadline"> <div class="linkeable" data-href="/animes/{{ID}}/favoured"> В избранном <div class="count">---</div> </div> </div> <div class="cc"> <div class="b-user c-column avatar"> <a class="avatar" href="/forum/site/610897-shikimori-404-fix" style="display: block; padding: 10px; text-align: center; color: #0066cc; text-decoration: none; overflow-wrap: anywhere;"> . </a> </div> </div> </div> <div class="block"> <div class="subheadline"> <div class="linkeable" data-href="/animes/{{ID}}/clubs"> В клубах <div class="count">---</div> </div> </div> <div class="b-clubs one-line"> <a href="/forum/site/610897-shikimori-404-fix" style="display: block; padding: 10px; text-align: center; color: #0066cc; text-decoration: none; overflow-wrap: anywhere;"> Если знаете как вернуть данную информацию напишите мне в топик скрипта на сайте </a> </div> </div> <div class="block"> <div class="subheadline m5"> <div class="linkeable" data-href="/animes/{{ID}}/collections"> В коллекциях <div class="count">---</div> </div> </div> <div class="block"> <div class="b-menu-line"> <span> <a class="b-link" href="/forum/site/610897-shikimori-404-fix" style="display: block; padding: 10px; text-align: center; color: #0066cc; text-decoration: none; overflow-wrap: anywhere;"> Если знаете как вернуть данную информацию напишите мне в топик скрипта на сайте </a> </span> </div> </div> </div> {{NEWS}} <div class="block"> <div class="subheadline m8">На других сайтах</div> {{EXTERNAL_LINKS}} </div> <div class="block"> <div class="subheadline m5">Субтитры</div> {{SUBTITLES}} </div> <div class="block"> <div class="subheadline m5">Озвучка</div> {{DUBBING}} </div> </div> </aside> </div> </div> </div> <footer class="l-footer"> <div class="copyright"> &copy; {{DOMAIN_NAME}}&nbsp; <span class="date">2011-2025</span> </div> <div class="links"> <a class="terms" href="/terms" tabindex="-1" title="Соглашение">Соглашение</a> <a class="for-right-holders" href="/for_right_holders" tabindex="-1" title="Для правообладателей">Для правообладателей</a> <a class="sitemap" href="/sitemap" tabindex="-1" title="Карта сайта">Карта сайта</a> </div> </footer> </section> <div class="b-shade"></div> <div class="b-to-top"> <div class="slide"></div> <div class="arrow"></div> </div> <div class="b-feedback"> <div class="hover-activator"></div> <span class="marker-positioner" data-action="/feedback" data-remote="true" data-type="html"> <div class="marker-text" data-text="Сообщить об ошибке"></div> </span> </div> <script id="js_export"> {{JS_EXPORT}} </script> <script> //<![CDATA[ window.gon={};gon.is_favoured=false; //]]> </script> </body> </html>
    `;

	// === ------- ===
	// === Утилиты ===
	// === ------- ===

	const log = (...args) => console.log("[404FIX]", ...args);
	const debug = (...args) =>
		CONFIG.DEBUG_MODE && console.log("[404FIX]", ...args);
	const error = (...args) => console.error("[404FIX]", ...args);

	// Вспомогательная функция для URL картинок
	// Если ссылка начинается с http, возвращает как есть. Иначе добавляет домен.
	const getFullUrl = (path) => {
		if (!path) return "";
		if (path.startsWith("http")) return path;
		return `${CONFIG.SITE_NAME}/${path}`;
	};

	let loaderInterval;
	const showLoader = () => {
		const h1 = document.querySelector(".dialog h1");
		const p = document.querySelector(".dialog p");
		if (h1 && p) {
			h1.textContent = "Загрузка данных...";
			p.innerHTML =
				'Пожалуйста, подождите. Время: <span id="loader-timer">0.0</span> c.';
			const startTime = Date.now();
			const timerSpan = document.getElementById("loader-timer");
			loaderInterval = setInterval(() => {
				if (timerSpan) {
					const elapsed = ((Date.now() - startTime) / 1000).toFixed(
						1,
					);
					timerSpan.textContent = elapsed;
				}
			}, 100);
		}
	};

	const hideLoader = () => {
		clearInterval(loaderInterval);
		log("Страница загружена, отображаем...");
	};

	/**
	 * Возвращает соответствующий оценке текст на Шикимори.
	 * @param {Number} score Оценка тайтла
	 * @returns На основе оценки возвращает соотствующий текст (напр. "Более-менее / Нормально / Великолепно").
	 */
	const getScoreText = (score) => {
		const s = Math.floor(Number(score));
		if (s < 1) return "Без оценки";
		if (s <= 1) return "Хуже некуда";
		if (s <= 2) return "Ужасно";
		if (s <= 3) return "Очень плохо";
		if (s <= 4) return "Плохо";
		if (s <= 5) return "Более-менее";
		if (s <= 6) return "Нормально";
		if (s <= 7) return "Хорошо";
		if (s <= 8) return "Отлично";
		if (s <= 9) return "Великолепно";
		return "Эпик вин!";
	};
	
	// Универсальная функция
	// Связано:
	// setupUserRateHandlers
	// STATUS_DATA
	// STATUS_CLASSES
	// Данные для статусов (тексты и классы)
	const STATUS_DATA = {
		anime: {
			planned: "Запланировано",
			watching: "Смотрю",
			rewatching: "Пересматриваю",
			completed: "Просмотрено",
			on_hold: "Отложено",
			dropped: "Брошено"
		},
		manga: {
			planned: "Запланировано",
			watching: "Читаю",
			rewatching: "Перечитываю",
			completed: "Прочитано",
			on_hold: "Отложено",
			dropped: "Брошено"
		},
		common: {
			remove: "Удалить из списка"
		}
	};

	// CSS классы для контейнера
	const STATUS_CLASSES = {
		planned: "planned",
		watching: "watching",
		rewatching: "rewatching",
		completed: "completed",
		on_hold: "on_hold",
		dropped: "dropped"
	};
	/**
	 * Генерирует HTML кнопку добавления в список.
	 * @param {number|string} targetId - ID аниме/манги.
	 * @param {string} targetType - "Anime" или "Manga" (с большой буквы, как требует API).
	 * @param {number|string} userId - ID пользователя.
	 * @param {Object|null} currentRate - Объект существующего статуса (или null, если нет).
	 *                                    Ожидается формат: { id, status, score, ... }
	 * @returns {string} HTML строка кнопки.
	 */
	const renderUserRateButton = (targetId, targetType, userId, currentRate = null) => {
		if (!userId || userId == null) return ""; // Если юзер не залогинен, кнопку не рисуем
		
		
		// Нормализация типа для словарей (anime/manga)
		const typeKey = targetType.toLowerCase(); 
		// Текстовки для этого типа
		const texts = STATUS_DATA[typeKey] || STATUS_DATA.anime;

		// Определяем текущее состояние
		const isExisting = !!(currentRate && currentRate.id);
		const status = isExisting ? currentRate.status : 'planned'; // дефолт для класса
		const rateId = isExisting ? currentRate.id : '';
		const score = isExisting ? currentRate.score : 0;
		
		// Определяем URL и Метод формы
		const formAction = isExisting ? `/api/v2/user_rates/${rateId}` : '/api/v2/user_rates';
		// В оригинале используется hidden input data-method, но мы будем обрабатывать это в JS
		
		// Текст текущего статуса
		const currentStatusText = isExisting ? texts[status] : "Добавить в список";
		const containerClass = isExisting ? STATUS_CLASSES[status] : 'planned'; // planned по дефолту для цвета кнопки "Добавить"

		// Генерируем опции выпадающего списка
		const optionsHtml = Object.keys(STATUS_CLASSES).map(key => {
			// Пропускаем текущий статус в списке? Обычно Шики показывает все.
			return `
				<div class="option add-trigger" data-status="${key}">
					<div class="text"><span class="status-name" data-text="${texts[key]}"></span></div>
				</div>`;
		}).join('');

		// Кнопка удаления (только если запись существует)
		const removeHtml = isExisting ? `
			<div class="option remove-trigger" data-status="delete">
				<div class="text"><span class="status-name" data-text="${STATUS_DATA.common.remove}"></span></div>
			</div>` : '';

		// Генерация триггера (разная разметка для "Добавить" и "Редактировать")
		let triggerHtml = '';
		if (isExisting) {
			triggerHtml = `
				<div class="edit-trigger">
					<div class="edit"></div>
					<div class="text"><span class="status-name" data-text="${currentStatusText}"></span></div>
				</div>`;
		} else {
			triggerHtml = `
				<div class="text add-trigger" data-status="planned">
					<div class="plus"></div>
					<span class="status-name" data-text="${currentStatusText}"></span>
				</div>`;
		}

		// Сборка всего HTML
		return `
		<div class="b-user_rate ${typeKey}-${targetId}" data-target_id="${targetId}" data-target_type="${targetType}">
			<div class="b-add_to_list ${containerClass}">
				<form action="${formAction}" data-type="json">
					<input type="hidden" name="frontend" value="1">
					<input type="hidden" name="user_rate[user_id]" value="${userId}">
					<input type="hidden" name="user_rate[target_id]" value="${targetId}">
					<input type="hidden" name="user_rate[target_type]" value="${targetType}">
					<input type="hidden" name="user_rate[status]" value="${status}">
					<input type="hidden" name="user_rate[score]" value="${score}">
					
					<div class="trigger">
						<div class="trigger-arrow"></div>
						${triggerHtml}
					</div>
					
					<div class="expanded-options">
						${optionsHtml}
						${removeHtml}
					</div>
				</form>
			</div>
		</div>`;
	};
	
	// === ------------------------- ===
	// === Модуль обработки запросов ===
	// === ------------------------- ===

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

	/**
	 *
	 * @param {String} endpoint API запрос.
	 * @param {Boolean} isWebEndpoint Использовать ли endpoint сайта, который вызывают некоторые фронт-енд функции. Например, комментарии обращаются к внутреннему API сайта, а не API, который описывается в документации.
	 * @returns JSON ответ или ошибку.
	 */
	const apiRequest = (endpoint, isWebEndpoint = false) => {
		return new Promise((resolve, reject) => {
			const requestFn = async () => {
				const url = isWebEndpoint ? `${endpoint}` : `/api${endpoint}`;
				try {
					const response = await fetch(url, {
						headers: { "User-Agent": CONFIG.USER_AGENT },
					});
					if (!response.ok)
						throw new Error(
							`API request failed: ${response.status} for ${url}`,
						);
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

	// === ----------------------- ===
	// === Модуль получения данных ===
	// === ----------------------- ===

	/**
	 * Получение текущего пользователя через whoami запрос.
	 * @returns Object описывающий залогиненного пользователя, null если пользователь не залогинен.
	 */
	const getCurrentUser = async () => {
		try {
			const user = await apiRequest("/users/whoami");
			if (!user || !user.id) return null;
			return {
				USER_ID: user.id,
				USER_NICK: user.nickname,
				USER_URL: user.url || `${CONFIG.SITE_NAME}/${user.nickname}`,
				USER_AVATAR: user.avatar || user.image?.x48 || "",
				USER_AVATAR_X16: user.image?.x16 || "",
				USER_AVATAR_X32: user.image?.x32 || "",
				USER_AVATAR_X48: user.image?.x48 || "",
				USER_AVATAR_X64: user.image?.x64 || "",
				USER_AVATAR_X80: user.image?.x80 || "",
				USER_AVATAR_X148: user.image?.x148 || "",
				USER_AVATAR_X160: user.image?.x160 || "",
			};
		} catch (err) {
			log(
				"Не удалось получить данные пользователя (возможно, не авторизован).",
				err.message,
			);
			return null;
		}
	};

	/**
	 * Получает ID стиля пользователя, а затем сам CSS.
	 * @param {Number} userId ID текущего пользователя.
	 * @returns {Promise<string|null>} Скомпилированный CSS или null в случае ошибки/отсутствия.
	 */
	const getUserStyle = async (userId) => {
		if (!userId) return null;

		try {
			log(
				`🎨 Запрашиваю данные пользователя ${userId} для получения ID стиля...`,
			);
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
					log(
						`🎨 Стиль ${styleId} не содержит скомпилированного CSS.`,
					);
					return null;
				}
			} else {
				log(
					`🎨 У пользователя ${userId} не установлен кастомный стиль.`,
				);
				return null;
			}
		} catch (err) {
			error(
				"❌ Ошибка при получении пользовательского стиля:",
				err.message,
			);
			return null; // Возвращаем null, чтобы не прерывать выполнение скрипта
		}
	};

	/**
	 * Загружает "донорскую" страницу для извлечения свежих ассетов: CSRF-токена, CSS и JS ссылок.
	 * @returns {Promise<string|Error>} Возвращает заполненный object, пустую или неполную структуру, или же ошибку.
	 */
	const getPageAssets = async () => {
		const assets = {
			CSRF_TOKEN: null,
			FETCHED_CSS: "",
			FETCHED_JS: "",
		};
		try {
			log(
				"📦 Запрашиваю страницу-донор для получения свежих ассетов (CSRF, CSS, JS)...",
			);
			const response = await fetch(CONFIG.DONOR_URL);
			if (!response.ok)
				throw new Error(`Статус ответа: ${response.status}`);

			const pageHtml = await response.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(pageHtml, "text/html");

			// 1. Извлекаем CSRF-токен
			const tokenElement = doc.querySelector('meta[name="csrf-token"]');
			if (tokenElement) {
				assets.CSRF_TOKEN = tokenElement.getAttribute("content");
				log("📦 CSRF-токен успешно извлечён.");
			} else {
				error("⚠️ Мета-тег csrf-token не найден на странице-доноре.");
			}

			// 2. Собираем все теги <link rel="stylesheet"> с путями /packs/ или /assets/
			const cssLinks = doc.querySelectorAll(
				'head > link[rel="stylesheet"][href^="/packs/"], head > link[rel="stylesheet"][href^="/assets/"]',
			);
			if (cssLinks) {
				assets.FETCHED_CSS = Array.from(cssLinks)
					.map((link) => link.outerHTML)
					.join("\n");
				log(`📦 Найдено и извлечено ${cssLinks.length} CSS-ссылок.`);
			} else {
				error("⚠️ CSS-ссылки не найдены на странице-доноре.");
			}

			// 3. Собираем все теги <script defer> с путями /packs/
			const jsScripts = doc.querySelectorAll(
				'head > script[defer][src*="/packs/js/"]',
			);
			if (jsScripts) {
				assets.FETCHED_JS = Array.from(jsScripts)
					.map((script) => script.outerHTML)
					.join("\n");
				log(`📦 Найдено и извлечено ${jsScripts.length} JS-ссылок.`);
			} else {
				error("⚠️ JS-скрипты не найдены на странице-доноре.");
			}

			return assets;
		} catch (err) {
			error("❌ Ошибка при получении ассетов страницы:", err.message);
			return assets; // Возвращаем пустую структуру, чтобы не сломать скрипт
		}
	};

	/**
	 *
	 * @param {Number} topicId ID топика, откуда запросить комментарии.
	 * @param {Number} maxComments Кол-во комментариев для загрузки.
	 * @returns
	 */
	const fetchComments = async (
		topicId,
		maxComments = CONFIG.COMMENTS_LIMIT,
	) => {
		if (!topicId) return [];
		let allComments = [],
			anchor = null,
			page = 1,
			limit = 3,
			fetched = 0;
		const initialEndpoint = `/comments?commentable_id=${topicId}&commentable_type=Topic&limit=${limit}&order=created_at&order_direction=desc`;
		let comments = await apiRequest(initialEndpoint);
		allComments = allComments.concat(comments);
		fetched += comments.length;
		while (fetched < maxComments && comments.length > 0) {
			anchor = comments[comments.length - 1].id;
			limit = 10;
			const webEndpoint = `/comments/fetch/${anchor}/Topic/${topicId}/${
				page + 1
			}/${limit}`;
			comments = await apiRequest(webEndpoint, true);
			allComments = allComments.concat(comments);
			fetched += comments.length;
			page++;
		}
		return allComments.slice(0, maxComments);
	};
	
	/**
	 * Получает статус пользователя для конкретного тайтла.
	 * @param {Object} user - Объект пользователя.
	 * @param {number|string} targetId - ID аниме/манги.
	 * @param {string} targetType - "anime" или "manga".
	 * @returns {Promise<Object|null>} Объект рейта или null.
	 */
	const fetchUserRate = async (user, targetId, targetType) => {
		if (!user || !user.USER_ID) return null;

		// API требует "Anime" или "Manga" с большой буквы
		const typeUpper = (targetType.toLowerCase() === 'anime') ? 'Anime' : 'Manga';
		
		try {
			// Используем твой apiRequest
			const res = await apiRequest(`/v2/user_rates?user_id=${user.USER_ID}&target_id=${targetId}&target_type=${typeUpper}`);
			
			// API возвращает массив. Если статус есть, он первый.
			if (Array.isArray(res) && res.length > 0) {
				return res[0];
			}
			return null;
		} catch (e) {
			error("[404Fix] fetchUserRate error:", e);
			return null;
		}
	};
	
	/**
	 * @description Получает полные данные сущности через 2 параллельных GraphQL запроса (Main + Details)
	 */
	const getEntityData = async (id, type) => {
		log(`📡 Загрузка данных: ${type} ID: ${id}`);

		const isAnime = type === "anime";
		const queryMain = isAnime
			? GRAPHQL_QUERY_ANIME_MAIN
			: GRAPHQL_QUERY_MANGA_MAIN;
		const queryDetails = isAnime
			? GRAPHQL_QUERY_ANIME_DETAILS
			: GRAPHQL_QUERY_MANGA_DETAILS;
		const missingImg = "/assets/globals/missing_preview.jpg";

		// Хелпер для выполнения GraphQL запроса
		const fetchGQL = async (query) => {
			const response = await fetch("/api/graphql", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"User-Agent": CONFIG.USER_AGENT,
					Accept: "application/json",
				},
				body: JSON.stringify({ query, variables: { id: String(id) } }),
			});
			if (!response.ok) throw new Error(`GQL Error: ${response.status}`);
			return await response.json();
		};
		
		const user_result = await getCurrentUser();
		
		const fetchUserRate = async (user_object) => {
            const user = user_object; // Получаем текущего юзера
            if (!user || !user.USER_ID) return null; // Если не залогинен, возвращаем null

            const targetType = isAnime ? "Anime" : "Manga";
            // Запрашиваем статус конкретно для этого тайтла
            return apiRequest(`/v2/user_rates?user_id=${user.USER_ID}&target_id=${id}&target_type=${targetType}`);
        };
		
		// 1. Запускаем ВСЕ запросы параллельно (Main GQL, Details GQL, Topics REST, Similar REST)
		const [mainResult, detailsResult, newsResult, similarResult, userRateResult] =
			await Promise.allSettled([
				fetchGQL(queryMain),
				fetchGQL(queryDetails),
				apiRequest(
					`/topics?forum=news&linked_type=${
						isAnime ? "Anime" : "Manga"
					}&linked_id=${id}&limit=30&order=comments_count&order_direction=desc`,
				),
				apiRequest(`/${type}s/${id}/similar`),
				fetchUserRate(user_result)
			]);

		// 2. Проверка основных данных
		if (mainResult.status === "rejected" || !mainResult.value.data) {
			throw new Error("Main GraphQL request failed");
		}

		// Достаем данные из ответов
		const mainDataRoot = mainResult.value.data;
		const detailsDataRoot =
			detailsResult.status === "fulfilled"
				? detailsResult.value.data
				: null;

		const mainList = isAnime ? mainDataRoot.animes : mainDataRoot.mangas;
		const detailsList = detailsDataRoot
			? isAnime
				? detailsDataRoot.animes
				: detailsDataRoot.mangas
			: [];

		if (!mainList || mainList.length === 0) {
			throw new Error("404: Entity not found");
		}

		// 3. МЕРДЖИМ (Объединяем) два объекта в один
		const mainEntity = mainList[0];
		const detailsEntity = detailsList[0] || {}; // Если второй запрос упал, будет пустой объект

		const entity = { ...mainEntity, ...detailsEntity };
		
		let listStatusData = null;
        if (userRateResult.status === "fulfilled" && Array.isArray(userRateResult.value)) {
            // API возвращает массив. Если статус есть, берем первый элемент.
            if (userRateResult.value.length > 0) {
                listStatusData = userRateResult.value[0];
            }
        }
		
		// 4. Комментарии
		const topicId = entity.topic ? entity.topic.id : null;
		let comments = [];
		if (topicId) {
			try {
				comments = await fetchComments(topicId, CONFIG.COMMENTS_LIMIT);
			} catch (err) {}
		}

		// 5. Обработка Ролей
		const processRoles = () => {
			const result = { main: [], supporting: [], staff: [] };

			if (entity.characterRoles) {
				entity.characterRoles.forEach((role) => {
					const char = role.character;
					if (!char) return;

					const imgUrl = char.image ? char.image.mainUrl : missingImg;
					const originalUrl = char.image
						? char.image.originalUrl
						: missingImg;
					const x48Url = char.image
						? char.image.miniAltUrl
						: missingImg;

					const mappedRole = {
						roles: role.rolesEn,
						roles_russian: role.rolesRu,
						character: {
							id: char.id,
							name: char.name,
							russian: char.russian,
							url: char.url,
							image: {
								preview: imgUrl,
								x96: imgUrl,
								x48: x48Url,
								original: originalUrl,
							},
						},
					};
					if (role.rolesEn.includes("Main"))
						result.main.push(mappedRole);
					else result.supporting.push(mappedRole);
				});
			}

			if (entity.personRoles) {
				entity.personRoles.forEach((role) => {
					const person = role.person;
					if (!person) return;

					const imgUrl = person.image
						? person.image.mainUrl
						: missingImg;
					const originalUrl = person.image
						? person.image.originalUrl
						: missingImg;
					const x48Url = person.image
						? person.image.miniAltUrl
						: missingImg;

					const mappedRole = {
						roles: role.rolesEn,
						roles_russian: role.rolesRu,
						person: {
							id: person.id,
							name: person.name,
							russian: person.russian,
							url: person.url,
							image: {
								preview: imgUrl,
								x96: imgUrl,
								x48: x48Url,
								original: originalUrl,
							},
						},
					};
					result.staff.push(mappedRole);
				});
			}
			return result;
		};

		const rolesData = processRoles();

		// 6. Обработка Related
		const processRelated = () => {
			if (!entity.related) return [];
			return entity.related
				.map((rel) => {
					const item = rel.anime || rel.manga;
					if (!item) return null;

					const posterUrl = item.poster
						? item.poster.mainUrl
						: "/assets/globals/missing_mini.png";
					const posterX48 = item.poster
						? item.poster.miniAltUrl
						: posterUrl;

					return {
						id: rel.id,
						relationKind: rel.relationKind,
						relation_russian: rel.relationText,
						anime: rel.anime
							? {
									id: rel.anime.id,
									name: rel.anime.name,
									russian: rel.anime.russian,
									kind: rel.anime.kind,
									url: rel.anime.url,
									episodes: rel.anime.episodes,
									aired_on: rel.anime.airedOn
										? `${rel.anime.airedOn.year}-01-01`
										: null,
									image: {
										preview: posterUrl,
										x96: posterUrl,
										x48: posterX48,
									},
								}
							: null,
						manga: rel.manga
							? {
									id: rel.manga.id,
									name: rel.manga.name,
									russian: rel.manga.russian,
									kind: rel.manga.kind,
									url: rel.manga.url,
									volumes: rel.manga.volumes,
									chapters: rel.manga.chapters,
									aired_on: rel.manga.airedOn
										? `${rel.manga.airedOn.year}-01-01`
										: null,
									image: {
										preview: posterUrl,
										x96: posterUrl,
										x48: posterX48,
									},
								}
							: null,
					};
				})
				.filter(Boolean);
		};

		const similarData =
			similarResult.status === "fulfilled" ? similarResult.value : [];

		// 7. Сборка финального объекта
		const finalData = {
			// anime / manga
			TYPE: type,
			// Anime / Manga
			TYPE_UP: isAnime ? "Anime" : "Manga",
			// animes / mangas
			TYPE_M: isAnime ? "animes" : "mangas",
			// https://shiki.one/api/doc/2.0/user_rates/index
			LIST_STATUS: listStatusData ? {
                id: listStatusData.id,
                status: listStatusData.status, // planned, watching, rewatching, completed, on_hold, dropped
                score: listStatusData.score,
                episodes: listStatusData.episodes,
                chapters: listStatusData.chapters,
                volumes: listStatusData.volumes,
                text: listStatusData.text,
                rewatches: listStatusData.rewatches,
                created_at: listStatusData.created_at,
                updated_at: listStatusData.updated_at
            } : [],
			INFO: {
				ID: entity.id,
				RU_NAME: entity.russian || entity.name,
				EN_NAME: entity.english || entity.name,
				TYPE: entity.kind,
				STATUS: entity.status,
				SCORE: entity.score,
				DESCRIPTION: entity.descriptionHtml,
				TOPIC_ID: topicId,
				GENRES: entity.genres || [],
				MYANIMELIST_ID: entity.malId,

				COUNT_LABEL: isAnime ? "Эпизоды" : "Тома/Главы",
				COUNT_VALUE: isAnime
					? entity.episodes || "?"
					: `${entity.volumes || "?"} / ${entity.chapters || "?"}`,
				DURATION_BLOCK: isAnime
					? `<div class='line-container'><div class='line'><div class='key'>Длительность:</div><div class='value'>${
							entity.duration || "?"
						} мин.</div></div></div>`
					: "",

				ORG_LABEL: isAnime ? "Студия" : "Издатель",
				ORGANIZATIONS: isAnime
					? entity.studios || []
					: entity.publishers || [],
			},
			POSTER: entity.poster ? entity.poster.originalUrl : "",

			RATINGS: {
				USER_SCORES: entity.scoresStats || [],
				USER_STATUS_STATS: entity.statusesStats || [],
			},

			// Медиа и Озвучка (превращаем строки в объекты {name: ...})
			VIDEOS: {
				// GraphQL возвращает массив строк ["a", "b"], а рендерер ждет [{name: "a"}, ...]
				SUBTITLES: isAnime
					? (entity.fansubbers || []).map((n) => ({ name: n }))
					: [],
				DUBBING: isAnime
					? (entity.fandubbers || []).map((n) => ({ name: n }))
					: [],
				LIST: entity.videos || [],
			},
			SCREENSHOTS: entity.screenshots || [],

			COMMENTS: comments.map((c) => ({
				id: c.id,
				text_preview: c.body ? c.body.substring(0, 100) + "..." : "",
				user_id: c.user_id,
				user: c.user ? c.user.nickname : "Guest",
				created_at: c.created_at,
			})),

			NEWS:
				newsResult.status === "fulfilled"
					? newsResult.value.map((t) => ({
							id: t.id,
							topic_title: t.topic_title,
							link: `/forum/news/${t.id}`,
						}))
					: [],

			EXTERNAL_LINKS: entity.externalLinks
				? entity.externalLinks.map((l) => ({
						url: l.url,
						kind: l.kind,
						site: l.kind.replace(/_/g, " "),
					}))
				: [],

			SIMILAR_ANIMES: similarData.slice(0, 12),
			RELATED: processRelated(),
			ROLES: rolesData,
		};

		log(`✅ Обработка данных завершена для ${type} ID: ${id}`);
		debug(finalData);
		return finalData;
	};

	// === ---------------- ===
	// === Модуль отрисовки ===
	// === ---------------- ===

	/**
	 * @description Генерирует HTML с кнопкой "Показать еще", если элементов больше лимита.
	 * @param {Array<string>} itemsArray - Массив HTML-строк элементов.
	 * @param {number} limit - Сколько элементов показывать сразу.
	 * @param {string} label - Текст кнопки (например, "показать всех").
	 * @param {boolean} isInline - Если true, скрытый блок будет inline (для тегов), иначе block.
	 * @returns {string} Итоговый HTML.
	 */
	const renderExpandable = (
		itemsArray,
		limit = 2,
		label = "показать всех",
	) => {
		if (!Array.isArray(itemsArray) || itemsArray.length === 0) return "";

		if (itemsArray.length <= limit) {
			return itemsArray.join("");
		}

		const visibleItems = itemsArray.slice(0, limit).join("");
		const hiddenItems = itemsArray.slice(limit).join("");

		return `
            <div class="expandable-wrapper">
                <div class="expandable-content">
                    ${visibleItems}<span class="b-show_more-content" style="display: none;">${hiddenItems}</span>
                </div>
                <div class="expandable-controls" style="clear: both; margin-top: 8px; width: 100%;">
                    <div class="b-show_more" style="cursor: pointer;">+ ${label}</div>
                    <div class="b-show_more hide-more" style="display: none; cursor: pointer;">— спрятать</div>
                </div>
            </div>
        `;
	};

	/**
	 * Рендерит блок связанных произведений.
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

		// Очередь для обновления статусов [ {id, type, domId} ]
		const updateQueue = [];

		const renderItem = (item) => {
			const entry = item.anime || item.manga;
			if (!entry) return "";

			const type = item.anime ? "anime" : "manga";
			const typePascalCase = type.charAt(0).toUpperCase() + type.slice(1);
			const typePlural = entry.url.startsWith("/ranobe") ? "ranobe" : (type === "anime" ? "animes" : "mangas");
			
			const url = getFullUrl(entry.url);
			const relationText = item.relation_russian;
			const image = entry.image?.preview ? getFullUrl(entry.image.preview) : "/assets/globals/missing_mini.png";
			const image2x = entry.image?.x96 ? getFullUrl(entry.image.x96) : image;
			const kindText = entry.kind.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
			const year = entry.aired_on?.split("-")[0] || entry.released_on?.split("-")[0] || "";

			// 1. Генерируем кнопку в состоянии "Добавить" (null)
			// Генерируем уникальный ID контейнера, чтобы потом найти его и обновить
			const containerUniqueId = `ur-related-${entry.id}-${Math.floor(Math.random() * 10000)}`;
			
			const userId = currentUser ? currentUser.USER_ID : null;
			const initialButtonHtml = renderUserRateButton(entry.id, typePascalCase, userId, null);

			// 2. Добавляем в очередь на обновление (если юзер залогинен)
			if (currentUser) {
				updateQueue.push({
					targetId: entry.id,
					targetType: typePascalCase,
					domId: containerUniqueId
				});
			}

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
							<a class="b-tag" href="/${typePlural}/kind/${entry.kind}">${kindText}</a>
							${year ? `<a class="b-tag" href="/${typePlural}/season/${year}">${year} год</a>` : ""}
							<div class="b-anime_status_tag other">${relationText}</div>
						</div>
					</div>
					<div class="user_rate-container" id="${containerUniqueId}">
						${initialButtonHtml}
					</div>
				</div>
			</div>`;
		};

		let html = `<div class="cc">${visibleItems.map(renderItem).join("")}</div>`;

		if (hiddenItems.length > 0) {
			html += `<div class="b-show_more unprocessed">+ показать остальное (${hiddenItems.length})</div>`;
			html += `<div class="b-show_more-more" style="display: none;">${hiddenItems.map(renderItem).join("")}<div class="hide-more">— спрятать</div></div>`;
		}

		// --- САМООБНОВЛЕНИЕ ---
		// Запускаем асинхронный процесс, который отработает ПОСЛЕ того, как HTML будет вставлен на страницу (document.write).
		if (updateQueue.length > 0) {
			setTimeout(async () => {
				log(`🔄 [Related] Начинаю обновление статусов для ${updateQueue.length} элементов...`);
				
				// Используем Promise.all или последовательно (зависит от мощности apiRequest).
				// apiRequest имеет очередь, так что можно кидать все сразу, они выстроятся.
				
				// Вариант: Запускаем все запросы параллельно (в очередь) и обновляем по мере прихода
				updateQueue.forEach(async (task) => {
					const rate = await fetchUserRate(currentUser, task.targetId, task.targetType);
					
					// Если статус есть (не null), обновляем кнопку
					if (rate) {
						const container = document.getElementById(task.domId);
						if (container) {
							const newHtml = renderUserRateButton(task.targetId, task.targetType, currentUser.USER_ID, rate);
							container.innerHTML = newHtml;
						}
					}
				});
				
				log("[Related] Все статусы обновлены");
			}, 100); // Небольшая задержка, чтобы DOM точно успел построиться после document.write
		}

		return html;
	};

	const renderScreenshotsAndVideos = (screenshots, videos) => {
		let html = "";

		// --- 1. Скриншоты ---
		if (Array.isArray(screenshots) && screenshots.length > 0) {
			// Формируем массив HTML-строк для каждого скриншота
			const screenshotItems = screenshots.map((scr, index) => {
				const preview = getFullUrl(scr.x166Url);
				const original = getFullUrl(scr.originalUrl);
				const title = `Кадр ${index + 1}`; // Можно добавить название аниме, если прокинуть его сюда

				return `
                    <a class="c-screenshot b-image entry-${index}" href="${original}" target="_blank" rel="noopener noreferrer" title="${title}">
                        <img src="${preview}" alt="${title}" loading="lazy" style="height: 100px; object-fit: cover; margin: 2px;">
                    </a>
                `;
			});

			// Оборачиваем в expandable (показываем 4, остальные скрываем)
			// Важно: isInline = true, чтобы картинки шли в ряд
			const screenshotsHtml = renderExpandable(
				screenshotItems,
				4,
				"показать все кадры",
			);

			html += `
                <div class="block">
                    <div class="subheadline">Кадры</div>
                    <div class="cc m0 c-screenshots">
                        ${screenshotsHtml}
                    </div>
                </div>
            `;
		}

		// --- 2. Видео ---
		if (Array.isArray(videos) && videos.length > 0) {
			const videoItems = videos.map((vid, index) => {
				const name = vid.name || vid.kind.toUpperCase();
				// Используем playerUrl если есть, иначе url
				// const link = vid.playerUrl || vid.url;
				// В твоем примере API imageUrl пустой ("//img..jpg"), поэтому лучше поставить заглушку или убрать картинку
				const thumb =
					vid.imageUrl && vid.imageUrl.length > 10
						? vid.imageUrl
						: "/assets/globals/missing_video.png";

				// ВАЖНО: Тут можно поменять target="_blank" на вызов своего плеера
				return `
                    <div class="b-video c-video entry-${index}" style="display: inline-block; width: 180px; margin: 5px; vertical-align: top;">
                        <a class="video-link" href="${
							vid.playerUrl
						}" target="_blank" rel="noopener noreferrer"
                           style="display: block; width: 100%; height: 100px; background: #000; position: relative; overflow: hidden;">
                            <!-- Если есть картинка, можно вставить img, иначе просто черный квадрат с иконкой Play -->
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 20px;">▶</div>
                        </a>
                        <span class="name" title="${name}" style="display: block; font-size: 11px; line-height: 1.2; margin-top: 3px;">
                            ${name}
                        </span>
                        <span class="marker" style="font-size: 10px; color: #999;">${vid.kind.toUpperCase()}</span>
                    </div>
                `;
			});

			// Показываем 3 видео, остальные скрываем
			const videosHtml = renderExpandable(
				videoItems,
				3,
				"показать все видео",
			);

			html += `
                <div class="block">
                    <div class="subheadline">Видео</div>
                    <div class="cc m0 c-videos">
                        ${videosHtml}
                    </div>
                </div>
            `;
		}

		return html;
	};

	/**
	 * --- УТИЛИТА: Рендер рейтинга ---
	 * Создает DOM-элементы рейтинга и внедряет их в контейнер.
	 * Автоматически удаляет старые элементы с тем же ключом (защита от дублей).
	 *
	 * @param {Object} params
	 * @param {HTMLElement} params.container - Родительский блок (.scores)
	 * @param {number|string} params.score   - Числовое значение оценки (например, 8.55)
	 * @param {string} params.key            - Уникальный ключ ('anilist', 'shiki', 'mal')
	 * @param {string} params.label          - Подпись под рейтингом (например 'AniList')
	 * @param {string} params.mode           - 'stars' (звезды) или 'headline' (текст в заголовке)
	 * @param {string} [params.subHeadlineSelector] - Селектор заголовка (нужен только для mode='headline')
	 */
	function renderRating({
		container,
		score,
		key,
		label,
		mode = "stars",
		subHeadlineSelector = ".subheadline",
	}) {
		if (!container || score == null || isNaN(score)) return;

		const numericScore = Number(score);
		const roundedScore = Math.round(numericScore);
		const scoreClass = `score-${roundedScore}`;
		const noticeText = getScoreText(numericScore);

		// 1. РЕЖИМ "STARS" (Блок со звездами)
		if (mode === "stars") {
			// Удаляем старые, если есть (очистка перед рендером)
			container.querySelector(`.${key}-average-score`)?.remove();
			container.querySelector(`.${key}-label`)?.remove();

			// Создаем обертку для звезд
			const rateDiv = document.createElement("div");
			rateDiv.className = `b-rate ${key}-average-score`;
			rateDiv.innerHTML = `
                <div class="stars-container">
                    <div class="hoverable-trigger"></div>
                    <div class="stars score ${scoreClass}"></div>
                    <div class="stars hover"></div>
                    <div class="stars background"></div>
                </div>
                <div class="text-score">
                    <div class="score-value ${scoreClass}">${numericScore}</div>
                    <div class="score-notice">${noticeText}</div>
                </div>
            `;

			// Создаем подпись
			const labelP = document.createElement("p");
			labelP.className = `score ${key}-label`;
			// Стили вынесены в JS, но лучше добавить их в CSS класс
			labelP.style.marginTop = "2px";
			labelP.style.fontSize = "12px";
			labelP.style.color = "#999";
			labelP.style.textAlign = "center";
			labelP.textContent = label;

			// Вставляем
			container.appendChild(rateDiv);
			container.appendChild(labelP);
		}

		// 2. РЕЖИМ "HEADLINE" (Текст в заголовке "Оценки людей")
		else if (mode === "headline") {
			// Ищем ближайший заголовок или глобальный
			const header =
				container
					.closest(".block")
					?.querySelector(subHeadlineSelector) ||
				document.querySelector(subHeadlineSelector); // фоллбэк

			if (header) {
				// Удаляем старый, если есть
				header.querySelector(`[data-rating-key="${key}"]`)?.remove();

				const span = document.createElement("span");
				span.dataset.ratingKey = key;
				span.style.marginLeft = "10px";
				span.style.fontSize = "14px";
				span.style.color = "#777";
				span.textContent = `| ${label}: ${numericScore}`;

				header.appendChild(span);
			}
		}
	}

	const renderTemplate = (html, data) => {
		const content_type = data.TYPE; // 'anime' or 'manga'
		// ^ {{CONTENT_TYPE}}
		debug(`Data type right now is: ${content_type}`);
		debug(`Another data type right now is: ${data.INFO.TYPE}`);
		const isAnime = content_type === "anime";
		const sectionName = isAnime ? "Аниме" : "Манга";

		// Вставка пользовательского CSS, если он есть
		if (data.USER_CSS) {
			html = html.replace(
				'<style id="custom_css" type="text/css"></style>',
				`<style id="custom_css" type="text/css">${data.USER_CSS}</style>`,
			);
		}

		// Формат: https://example.com
		html = html.replaceAll("{{SITE_NAME}}", CONFIG.SITE_NAME || "");
		// Формат: example.com
		html = html.replaceAll("{{DOMAIN_NAME}}", CONFIG.DOMAIN_NAME || "");

		// Замены основных плейсхолдеров
		html = html.replaceAll("{{ID}}", data.INFO.ID || "");
		html = html.replaceAll("{{RU_NAME}}", data.INFO.RU_NAME || "N/A");
		html = html.replaceAll("{{EN_NAME}}", data.INFO.EN_NAME || "N/A");
		html = html.replaceAll("{{TYPE}}", data.INFO.TYPE || "?"); // tv / ova
		html = html.replaceAll("{{CONTENT_TYPE}}", content_type || "?"); // anime / manga
		html = html.replaceAll("{{CONTENT_TYPE_UP}}", data.TYPE_UP || "?"); // Anime / Manga
		html = html.replaceAll("{{CONTENT_TYPE_M}}", data.TYPE_M || "?"); // animes /
		html = html.replaceAll("{{SECTION_NAME}}", sectionName || "?");
		html = html.replaceAll("{{STATUS}}", data.INFO.STATUS || "N/A");
		html = html.replaceAll("{{SCORE}}", data.INFO.SCORE || "N/A");

		// html = html.replaceAll('{{EPISODES}}', data.INFO.EPISODES || '?');
		html = html.replaceAll("{{COUNT_LABEL}}", data.INFO.COUNT_LABEL);
		html = html.replaceAll("{{COUNT_VALUE}}", data.INFO.COUNT_VALUE);

		html = html.replaceAll(
			"{{DURATION_BLOCK}}",
			data.INFO.DURATION_BLOCK || "? мин.",
		);

		html = html.replaceAll("{{SOURCE}}", data.INFO.SOURCE || "Отсутствует");
		html = html.replaceAll("{{POSTER}}", getFullUrl(data.POSTER) || "");
		html = html.replaceAll(
			"{{DESCRIPTION}}",
			data.INFO.DESCRIPTION || "Описание отсутствует",
		);
		html = html.replaceAll(
			"{{MYANIMELIST_ID}}",
			data.INFO.MYANIMELIST_ID || "",
		);
		html = html.replaceAll(
			"{{COMMENTS_COUNT}}",
			Array.isArray(data.COMMENTS) ? data.COMMENTS.length : 0,
		);
		const commentsAnchor =
			Array.isArray(data.COMMENTS) && data.COMMENTS.length > 0
				? data.COMMENTS[0].id
				: 0;
		html = html.replaceAll("{{COMMENTS_ANCHOR}}", commentsAnchor);
		html = html.replaceAll("{{TOPIC_ID}}", data.INFO.TOPIC_ID || "");
		html = html.replaceAll(
			"{{AUTHENTICITY_TOKEN}}",
			data.ASSETS.CSRF_TOKEN || "",
		);
		html = html.replace("{{FETCHED_CSS}}", data.ASSETS.FETCHED_CSS || "");
		html = html.replace("{{FETCHED_JS}}", data.ASSETS.FETCHED_JS || "");

		if (data.USER) {
			html = html.replaceAll("{{USER_ID}}", data.USER.USER_ID);
			html = html.replaceAll("{{USER_NICK}}", data.USER.USER_NICK);
			html = html.replaceAll(
				"{{USER_URL}}",
				getFullUrl(data.USER.USER_URL),
			);
			html = html.replaceAll(
				"{{USER_AVATAR}}",
				getFullUrl(data.USER.USER_AVATAR),
			);
			html = html.replaceAll(
				"{{USER_AVATAR_X16}}",
				getFullUrl(data.USER.USER_AVATAR_X16),
			);
			html = html.replaceAll(
				"{{USER_AVATAR_X32}}",
				getFullUrl(data.USER.USER_AVATAR_X32),
			);
			html = html.replaceAll(
				"{{USER_AVATAR_X48}}",
				getFullUrl(data.USER.USER_AVATAR_X48),
			);
			html = html.replaceAll(
				"{{USER_AVATAR_X64}}",
				getFullUrl(data.USER.USER_AVATAR_X64),
			);
			html = html.replaceAll(
				"{{USER_AVATAR_X80}}",
				getFullUrl(data.USER.USER_AVATAR_X80),
			);
			html = html.replaceAll(
				"{{USER_AVATAR_X148}}",
				getFullUrl(data.USER.USER_AVATAR_X148),
			);
			html = html.replaceAll(
				"{{USER_AVATAR_X160}}",
				getFullUrl(data.USER.USER_AVATAR_X160),
			);
		}

		html = html.replaceAll(
			"{{RELATED_CONTENT}}",
			renderRelatedBlock(data.RELATED, data.USER),
		);
		
		function renderSimilarAnimes(animes) {
			if (!Array.isArray(animes) || animes.length === 0) return "";
			return animes
				.slice(0, CONFIG.SIMILAR_LIMIT)
				.map((anime) => {
					const id = anime.id;
					const kind =
						anime.kind === "tv" ? "anime" : anime.kind || "anime";
					const url = `/animes/${id}`;
					const nameEn = anime.name || "";
					const nameRu = anime.russian || nameEn;
					const airedOn = anime.aired_on?.split("-")?.[0] || "";

					// ВЫБИРАЕМ ОПТИМАЛЬНОЕ ИЗОБРАЖЕНИЕ:
					// x96 или preview - идеальны для превью. Original - слишком большой и медленный.
					const imagePath =
						anime.image?.x96 ||
						anime.image?.preview ||
						anime.image?.original ||
						"";

					if (!imagePath) {
						return ""; // Пропускаем аниме без изображения
					}

					// const imageUrl = `https://shikimori.one${imagePath}`;
					const imageUrl = getFullUrl(imagePath);

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
                    data-tooltip_url="/animes/${id}/tooltip"
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
                  <meta content="${
						anime.image?.original || ""
					}" itemprop="image">
                  <meta content="${
						anime.image?.x48 || ""
					}" itemprop="thumbnailUrl">
                  <meta content="${airedOn}" itemprop="dateCreated">
                </article>`.trim();
				})
				.join("");
		}

		function renderSimilarAnimesBlock(animes) {
			const limited = animes.slice(0, 7);
			const entries = renderSimilarAnimes(limited);
			return entries ? `<div class="cc cc-similar">${entries}</div>` : "";
		}
		// === Похожие аниме ===
		if (data.SIMILAR_ANIMES && Array.isArray(data.SIMILAR_ANIMES)) {
			html = html.replace(
				"{{SIMILAR_ANIMES}}",
				renderSimilarAnimesBlock(data.SIMILAR_ANIMES),
			);
		} else {
			html = html.replace("{{SIMILAR_ANIMES}}", "");
		}

		/**
		 * @description Рендерит HTML-блок для персонажей.
		 * @param {Array} charactersList - Массив персонажей.
		 * @param {Boolean} isMain - Флаг: true для главных (показать всех), false для второстепенных (скрывать под спойлер).
		 * @returns {string} Готовый HTML-блок.
		 */
		const renderCharacters = (charactersList, isMain = true) => {
			if (!Array.isArray(charactersList) || charactersList.length === 0) {
				// Если главных героев нет, выводим заглушку. Если нет второстепенных — просто пустоту.
				if (isMain) {
					return '<div class="cc m0" style="text-align: center; padding: 20px; color: #666; font-style: italic;">Нет информации о главных героях.</div>';
				}
				return "";
			}

			const itemsHtml = charactersList.map((role) => {
				const char = role.character;
				if (!char) return "";

				const url = getFullUrl(char.url);
				const imagePreview = char.image?.preview
					? getFullUrl(char.image.preview)
					: "/assets/globals/missing_preview.jpg";
				const imageX96 = char.image?.x96
					? getFullUrl(char.image.x96)
					: imagePreview;

				return `
				<article class="c-column b-catalog_entry c-character entry-${
					char.id
				}" id="${char.id}" itemscope itemtype="http://schema.org/Person">
					<meta content="${char.image.original}" itemprop="image">
					<meta content="${char.image.x48}" itemprop="thumbnailUrl">
					<a class="cover bubbled" data-delay="150" data-tooltip_url="/characters/${
						char.id
					}/tooltip" href="${url}">
						<span class="image-decor">
							<span class="image-cutter">
								<picture>
									<source srcset="${imagePreview}, ${imageX96} 2x" type="image/webp">
									<img alt="${
										char.russian || char.name
									}" src="${imagePreview}" srcset="${imageX96} 2x">
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
			});

			let contentHtml = "";

			if (isMain) {
				// Главные герои: показываем всех
				contentHtml = itemsHtml.join("");
			} else {
				// Второстепенные: прячем под спойлер (лимит 7)
				contentHtml = renderExpandable(itemsHtml, 7, "показать всех");
			}

			const gridHtml = `<div class="cc m0">${contentHtml}</div>`;

			if (isMain) {
				return gridHtml;
			} else {
				// Для второстепенных добавляем обертку и заголовок, так как они находятся вне основного блока в шаблоне
				return `
                    <div class="c-characters m0">
                        <div class="subheadline">Второстепенные герои</div>
                        ${gridHtml}
                    </div>
                `;
			}
		};
		
		html = html.replaceAll(
			"{{MAIN_CHARACTERS}}",
			renderCharacters(data.ROLES.main, true),
		);

		html = html.replaceAll(
			"{{SUPPORTING_CHARACTERS}}",
			renderCharacters(data.ROLES.supporting, false),
		);

		function renderStaffBlock(staff) {
			if (!Array.isArray(staff) || staff.length === 0) {
				return '<div class="cc" style="text-align:center;padding:20px;color:#666;font-style:italic;">Нет информации о команде.</div>';
			}

			// 1) Таблица важности ролей (ближе к Shikimori)
			const ROLE_PRIORITY = {
				"Original Creator": 1,
				Story: 1,
				Script: 1,

				Director: 2,
				"Series Composition": 2,
				"Episode Director": 3,
				Storyboard: 3,

				"Chief Animation Director": 4,
				"Animation Director": 5,
				"Character Design": 5,

				"Chief Producer": 6,
				Producer: 7,

				"Key Animation": 8,
				"2nd Key Animation": 9,
				"In-Between Animation": 10,
			};

			// 2) Функция определения важности человека
			function getPersonPriority(role) {
				return Math.min(
					...role.roles.map((r) => ROLE_PRIORITY[r] || 999),
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
              ${sortedStaff
					.map((role) => {
						const p = role.person;
						const id = p.id;
						// const url = `https://shikimori.one${p.url}`;
						const url = getFullUrl(p.url);

						const imgPreview = p.image?.preview
							? `${p.image.preview}`
							: "/assets/globals/missing/mini.png";

						const img2x = p.image?.x96
							? getFullUrl(p.image.x96)
							: img4x;

						const img4x = p.image?.x48
							? getFullUrl(p.image.x48)
							: "/assets/globals/missing/mini@4x.png";

						const roleTags = role.roles
							.map((r) => `<div class="b-tag">${r}</div>`)
							.join("");

						return `
                      <div class="b-db_entry-variant-list_item"
                          data-id="${id}" data-text="${p.russian || p.name}"
                          data-type="person" data-url="${url}">
                          <a class="image bubbled" href="${url}">
                              <picture>
                                  <img src="${img4x}" srcset="${img2x} 2x" alt="${
										p.russian || p.name
									}">
                              </picture>
                          </a>
                          <div class="info">
                              <div class="name">
                                  <a class="b-link bubbled" href="${url}">
                                      <span class="name-en">${p.name}</span>
                                      <span class="name-ru">${
											p.russian || p.name
										}</span>
                                  </a>
                              </div>
                              <div class="line multiline">
                                  <div class="key">${
										role.roles.length > 1
											? "Роли:"
											: "Роль:"
									}</div>
                                  <div class="value">${roleTags}</div>
                              </div>
                          </div>
                      </div>
                  `;
					})
					.join("")}
          </div>
        `;
		}
		html = html.replace("{{STAFF}}", renderStaffBlock(data.ROLES.staff));

		// data.SCREENSHOTS и data.VIDEOS.LIST приходят из getEntityData
		const mediaBlockHtml = renderScreenshotsAndVideos(
			data.SCREENSHOTS,
			data.VIDEOS.LIST,
		);
		html = html.replaceAll(
			"{{SCREENSHOTS_AND_VIDEOS}}",
			mediaBlockHtml || "",
		);

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
		html = html.replaceAll("{{RATING}}", data.INFO.RATING || "");

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
		html = html.replaceAll("{{SCORE}}", score.toFixed(2));
		html = html.replaceAll("{{SCORE_ROUND}}", scoreRound);
		html = html.replaceAll("{{RATING_NOTICE}}", getRatingNotice(score));
		html = html.replaceAll(
			"{{RATING_TOOLTIP}}",
			getRatingTooltip(data.INFO.RATING),
		);

		html = html.replaceAll("{{ORG_LABEL}}", data.INFO.ORG_LABEL);

		const orgs = data.INFO.ORGANIZATIONS || [];
		const orgsHtml = orgs
			.map(
				(org) =>
					`<a href="/${data.TYPE}s/${
						data.TYPE === "anime" ? "studio" : "publisher"
					}/${org.id}-${encodeURIComponent(org.name)}"
              title="${org.name}">
              ${
					org.imageUrl
						? `<img src="${org.imageUrl}" class="studio-logo">`
						: `<span class="b-tag">${org.name}</span>`
				}
           </a>`,
			)
			.join(" ");
		html = html.replaceAll("{{ORGANIZATIONS}}", orgsHtml);

		function renderGenres(genres) {
			if (!Array.isArray(genres) || genres.length === 0) return "";
			return (
				`<div class='key'>Жанры:</div><div class='value'>` +
				genres
					.map((g) => {
						const en = g.name || "";
						const ru = g.russian || en;
						const id = g.id || "";
						const href = `/animes/genre/${id}-${en}`;
						return `<a class="b-tag bubbled" href="${href}"><span class='genre-en'>${en}</span><span class='genre-ru'>${ru}</span></a>`;
					})
					.join("\n") +
				`</div>`
			);
		}
		html = html.replaceAll("{{GENRES}}", renderGenres(data.INFO.GENRES));

		function renderUserRatingsHTML(userScores) {
			if (!Array.isArray(userScores) || userScores.length === 0)
				return "";
			const statsArray = userScores.map((item) => [
				String(item.score),
				item.count,
			]);
			const dataStats = JSON.stringify(statsArray).replace(
				/"/g,
				"&quot;",
			);
			return `<div class="block"><div class="subheadline">Оценки людей</div><div data-bar="horizontal" data-stats="${dataStats}" id="rates_scores_stats"></div></div>`;
		}
		html = html.replaceAll(
			"{{USER_RATINGS}}",
			renderUserRatingsHTML(data.RATINGS.USER_SCORES),
		);

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
			const total = userStatuses.reduce(
				(sum, item) => sum + item.count,
				0,
			);
			return `<div class="block"><div class="subheadline">В списках у людей</div><div data-bar="horizontal" data-entry_type="anime" data-stats="${JSON.stringify(
				statsArray,
			).replace(
				/"/g,
				"&quot;",
			)}" id="rates_statuses_stats"></div><div class="total-rates">В списках у ${total} человек</div></div>`;
		}
		html = html.replaceAll(
			"{{USER_STATUSES}}",
			renderUserStatusesHTML(data.RATINGS.USER_STATUS_STATS),
		);
		
		const userRateButtonHtml = renderUserRateButton(
			data.INFO.ID, 
			isAnime ? "Anime" : "Manga", 
			data.USER.USER_ID || null, 
			data.LIST_STATUS
		);
		html = html.replaceAll(
			"{{USER_RATE_BUTTON}}",
			userRateButtonHtml
		);
		
		
		function renderDubbing(dubbing) {
			if (!Array.isArray(dubbing) || dubbing.length === 0) return "";
			const visible = dubbing
				.slice(0, 5)
				.map(
					(d) =>
						`<div class="b-menu-line" title="${d.name}">${d.name}</div>`,
				)
				.join("\n");
			const hidden = dubbing
				.slice(5)
				.map(
					(d) =>
						`<div class="b-menu-line" title="${d.name}">${d.name}</div>`,
				)
				.join("\n");
			if (!hidden) return visible;
			return `${visible}<div class="b-show_more unprocessed">+ показать всех</div><div class="b-show_more-more" style="display:none;">${hidden}<div class="hide-more">&mdash; спрятать</div></div>`;
		}
		html = html.replaceAll(
			"{{DUBBING}}",
			renderDubbing(data.VIDEOS.DUBBING),
		);

		function renderSubtitles(subtitles) {
			if (!Array.isArray(subtitles) || subtitles.length === 0) return "";
			return subtitles
				.map(
					(s) =>
						`<div class="b-menu-line" title="${s.name}">${s.name}</div>`,
				)
				.join("\n");
		}
		html = html.replaceAll(
			"{{SUBTITLES}}",
			renderSubtitles(data.VIDEOS.SUBTITLES),
		);

		function renderNewsHTML(newsArray) {
			if (!Array.isArray(newsArray) || newsArray.length === 0) {
				log("Массив новостей пуст!");
				debug("News array: ", newsArray);
				return "";
			}
			return `<div class="b-menu-links menu-topics-block history m30"><div class="subheadline m5">Новости</div><div class="block">${newsArray
				.map(
					(n) =>
						`<a class="b-menu-line entry b-link" href="${n.link}" style="display:block; margin:4px 0;"><span class="name">${n.topic_title}</span></a>`,
				)
				.join("\n")}</div></div>`;
		}
		html = html.replaceAll("{{NEWS}}", renderNewsHTML(data.NEWS));

		html = html.replaceAll(
			"{{COMMENTS}}",
			data.COMMENTS?.map(
				(c) => `${c.user || "Anon"}: ${c.text_preview}`,
			).join("\n") || "",
		);

		function renderExternalLinks(links) {
			if (!Array.isArray(links) || links.length === 0) return "";
			return links
				.map((l) => {
					const url = l.url || "#";
					const siteName = l.site || "Unknown";
					// Use the raw kind for the class. If it's missing, default to 'unknown'
					const siteClass = l.kind || "unknown";

					return `<div class="b-external_link ${siteClass} b-menu-line"><div class="linkeable b-link" data-href="${url}">${siteName}</div></div>`;
				})
				.join("\n");
		}
		html = html.replaceAll(
			"{{EXTERNAL_LINKS}}",
			renderExternalLinks(data.EXTERNAL_LINKS),
		);

		return html;
	};

	// === ---------------- ===
	// === Финальная логика ===
	// === ---------------- ===

	// === Поддержка кнопки "Ответить" ===
	const setupReplyButtons = () => {
		const textarea = document.querySelector(
			'textarea[name="comment[body]"]',
		);
		if (!textarea) {
			log("Редактор не найден — кнопка Ответить не будет работать");
			return false;
		}

		document.addEventListener("click", (e) => {
			const btn = e.target.closest(".item-reply");
			if (!btn) return;

			const comment = btn.closest(".b-comment");
			if (!comment) return;

			const commentId =
				comment.id.replace("comment-", "") ||
				comment.dataset.track_comment;
			const userId = comment.dataset.user_id;
			const nickname =
				comment.dataset.user_nickname ||
				comment.querySelector(".name a")?.textContent.trim() ||
				"анон";

			if (!commentId || !userId) return;

			e.preventDefault();

			const tag = `[comment=${commentId};${userId}], `;
			const val = textarea.value;
			const insert = val && !val.endsWith("\n") ? "\n" + tag : tag;

			textarea.value = val + insert;
			textarea.focus();
			textarea.setSelectionRange(
				textarea.value.length,
				textarea.value.length,
			);
			textarea.scrollIntoView({ behavior: "smooth", block: "center" });

			// Кнопка "назад"
			const back = document.querySelector(".return-to-reply");
			if (back) {
				back.style.visibility = "visible";
				back.textContent = `к @${nickname}`;
				back.onclick = () => {
					comment.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
				};
			}

			// Визуальный отклик
			btn.style.opacity = "0.5";
			setTimeout(() => (btn.style.opacity = ""), 200);
		});

		log("Кнопка «Ответить» активирована");
		return true;
	};

	// === Поддержка кнопки "Цитировать" ===
	const setupQuoteButtons = () => {
		const textarea = document.querySelector(
			'textarea[name="comment[body]"]',
		);
		if (!textarea) {
			log("Редактор не найден — кнопка Цитировать не будет работать");
			return false;
		}

		document.addEventListener("click", (e) => {
			const btn = e.target.closest(".item-quote");
			if (!btn) return;

			const comment = btn.closest(".b-comment");
			if (!comment) return;

			const commentId = comment.id || comment.dataset.track_comment;
			const userId = comment.dataset.user_id;
			const nickname =
				comment.dataset.user_nickname ||
				comment.querySelector(".name a")?.textContent.trim() ||
				"анон";

			e.preventDefault();

			// Пытаемся получить выделенный текст
			let selectedText = "";
			const selection = window.getSelection();

			// Проверяем, есть ли выделение внутри текущего комментария
			if (selection.rangeCount > 0 && selection.toString().trim()) {
				const range = selection.getRangeAt(0);
				const selectedNode = range.commonAncestorContainer;

				// Проверяем, находится ли выделение внутри этого комментария
				if (comment.contains(selectedNode)) {
					selectedText = selection.toString().trim();
				}
			}

			let quoteText;

			if (selectedText) {
				// Если есть выделенный текст - используем его
				quoteText = selectedText;
				log(
					`Цитируется выделенный текст: ${quoteText.substring(
						0,
						100,
					)}...`,
				);
			} else {
				// Если нет выделения - берем весь текст комментария
				const commentBody = comment.querySelector(".body");
				if (!commentBody) return;

				const commentText =
					commentBody.textContent || commentBody.innerText;
				const maxLength = 50000;
				quoteText =
					commentText.length > maxLength
						? commentText.substring(0, maxLength) + "..."
						: commentText;

				log(`Выделения нет, цитируется весь комментарий`);
			}

			// Очищаем текст для форматирования
			const cleanText = quoteText
				.replace(/\n\s*\n/g, "\n\n")
				.replace(/[ \t]+/g, " ")
				.trim();

			if (!cleanText) {
				log("Нет текста для цитирования");
				return;
			}

			// Формируем тег цитаты
			const quoteTag = `[quote=${commentId.replace(
				"comment-",
				"",
			)};${userId};${nickname}]${cleanText}[/quote]\n\n`;

			// Вставляем в текстовое поле
			const val = textarea.value;
			const insert =
				val && !val.endsWith("\n") ? "\n" + quoteTag : quoteTag;

			textarea.value = val + insert;
			textarea.focus();
			textarea.setSelectionRange(
				textarea.value.length,
				textarea.value.length,
			);
			textarea.scrollIntoView({ behavior: "smooth", block: "center" });

			// Снимаем выделение после цитирования
			if (selection.rangeCount > 0) {
				selection.removeAllRanges();
			}

			// Визуальный отклик
			btn.style.opacity = "0.5";
			setTimeout(() => (btn.style.opacity = ""), 200);

			log(
				`Цитата добавлена: комментарий ${commentId}, пользователь ${nickname}`,
			);
		});

		// Также добавляем обработку для мобильной версии
		document.addEventListener("click", (e) => {
			const btn = e.target.closest(".item-quote-mobile");
			if (!btn) return;

			// Находим соответствующую обычную кнопку
			const comment = btn.closest(".b-comment");
			const mainBtn = comment?.querySelector(".item-quote");

			if (mainBtn) {
				mainBtn.click();
			}
		});

		log("Кнопка «Цитировать» активирована (с поддержкой выделения текста)");
		return true;
	};

	// --- Если кратко, оно кривое
	// === Поддержка кнопок списков (Dropdown + API Request) ===
	const setupAddToListButtons = () => {
		// Словарь для отображения статусов и CSS классов
		const STATUS_MAP = {
			planned: { label: "Запланировано", class: "planned" },
			watching: { label: "Смотрю", class: "watching" },
			rewatching: { label: "Пересматриваю", class: "rewatching" },
			completed: { label: "Просмотрено", class: "completed" },
			on_hold: { label: "Отложено", class: "on_hold" },
			dropped: { label: "Брошено", class: "dropped" },
		};

		// Единый слушатель на body (делегирование событий)
		document.body.addEventListener("click", async (e) => {
			// 1. Клик по ТРИГГЕРУ (открыть/закрыть меню)
			const trigger = e.target.closest(".b-add_to_list .trigger");
			if (trigger) {
				e.preventDefault();
				e.stopPropagation(); // Чтобы не сработал клик "снаружи"

				const container = trigger.closest(".b-add_to_list");
				const expanded = container.querySelector(".expanded-options");

				// Закрываем все другие открытые меню на странице
				document.querySelectorAll(".expanded-options").forEach((el) => {
					if (el !== expanded) el.style.display = "none";
				});

				// Тогглим текущее
				const isVisible = expanded.style.display === "block";
				expanded.style.display = isVisible ? "none" : "block";
				return;
			}

			// 2. Клик по ОПЦИИ (выбор статуса)
			const option = e.target.closest(
				".b-add_to_list .expanded-options .option",
			);
			if (option) {
				e.preventDefault();

				const container = option.closest(".b-add_to_list");
				const expanded = container.querySelector(".expanded-options");
				const form = container.querySelector("form");

				// Получаем данные
				const newStatus = option.dataset.status; // completed, planned...
				const targetId = form.querySelector(
					'input[name="user_rate[target_id]"]',
				).value;
				const targetType = form.querySelector(
					'input[name="user_rate[target_type]"]',
				).value;
				const userId = form.querySelector(
					'input[name="user_rate[user_id]"]',
				).value; // Если нужно

				// Визуально обновляем СРАЗУ (оптимистичный UI)
				updateUI(container, newStatus);

				// Закрываем меню
				expanded.style.display = "none";

				// Отправляем запрос на сервер
				try {
					const csrfToken = document.querySelector(
						'meta[name="csrf-token"]',
					)?.content;

					const response = await fetch("/api/v2/user_rates", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-CSRF-Token": csrfToken, // Важно для Rails
							"User-Agent": CONFIG.USER_AGENT,
						},
						body: JSON.stringify({
							user_rate: {
								target_id: targetId,
								target_type: targetType,
								status: newStatus,
								user_id: userId,
							},
						}),
					});

					if (!response.ok) throw new Error("Failed to update rate");
					log(`✅ Статус обновлен на: ${newStatus}`);
				} catch (err) {
					error("Ошибка при обновлении статуса:", err);
					alert("Не удалось обновить статус. Проверьте консоль.");
					// Можно откатить UI обратно, если нужно
				}
				return;
			}

			// 3. Клик ВНЕ меню (закрыть всё)
			if (!e.target.closest(".b-add_to_list")) {
				document.querySelectorAll(".expanded-options").forEach((el) => {
					el.style.display = "none";
				});
			}
		});

		// Вспомогательная функция обновления внешнего вида кнопки
		function updateUI(container, statusKey) {
			const map = STATUS_MAP[statusKey] || {
				label: statusKey,
				class: "planned",
			};

			// 1. Меняем класс контейнера (цвет кнопки)
			// Удаляем старые классы статусов
			Object.values(STATUS_MAP).forEach((s) =>
				container.classList.remove(s.class),
			);
			// Добавляем новый
			container.classList.add(map.class);

			// 2. Меняем текст
			const textSpan = container.querySelector(".trigger .status-name");
			if (textSpan) {
				textSpan.textContent = map.label;
				textSpan.setAttribute("data-text", map.label);
			}

			// 3. Меняем значение в скрытом инпуте (на всякий случай)
			const input = container.querySelector(
				'input[name="user_rate[status]"]',
			);
			if (input) input.value = statusKey;
		}

		log("Кнопки «Добавить в список» активированы (Native Fetch)");
	};

	const setupShowMoreHandlers = () => {
		document.body.addEventListener("click", (e) => {
			// Клик по "+ показать всех"
			if (e.target.matches(".b-show_more")) {
				const showBtn = e.target;
				// Ищем общий контейнер
				const wrapper = showBtn.closest(".expandable-wrapper");
				if (!wrapper) return; // Защита, если используется старая верстка где-то

				const hiddenContent = wrapper.querySelector(
					".b-show_more-content",
				);
				const hideBtn = wrapper.querySelector(".hide-more");

				if (hiddenContent) {
					showBtn.style.display = "none"; // Скрываем кнопку "+"
					hiddenContent.style.display = "inline"; // Показываем контент (inline чтобы не ломать сетку)
					if (hideBtn) hideBtn.style.display = "block"; // Показываем кнопку "-"
				}
			}

			// Клик по "— спрятать"
			if (e.target.matches(".hide-more")) {
				const hideBtn = e.target;
				const wrapper = hideBtn.closest(".expandable-wrapper");
				if (!wrapper) return;

				const hiddenContent = wrapper.querySelector(
					".b-show_more-content",
				);
				const showBtn = wrapper.querySelector(".b-show_more");

				if (hiddenContent) {
					hiddenContent.style.display = "none"; // Скрываем контент
					hideBtn.style.display = "none"; // Скрываем кнопку "-"
					if (showBtn) showBtn.style.display = "block"; // Возвращаем кнопку "+"
				}
			}
		});

		log("Обработчики Show More активированы (версия 2.0)");
	};

	// Вспомогательные функции для кнопки избраного
	async function add_favorite(e, t) {
		const n = document.querySelector('meta[name="csrf-token"]')?.content;
		if (!n) return !1;
		try {
			return (
				await fetch(`/api/favorites/${e}/${t}`, {
					method: "POST",
					headers: {
						"X-CSRF-Token": n,
						"X-Requested-With": "XMLHttpRequest",
						Accept: "application/json",
					},
					credentials: "include",
				})
			).ok;
		} catch {
			return !1;
		}
	}
	async function delete_favorite(e, t) {
		const n = document.querySelector('meta[name="csrf-token"]')?.content;
		if (!n) return !1;
		try {
			return (
				await fetch(`/api/favorites/${e}/${t}`, {
					method: "DELETE",
					headers: {
						"X-CSRF-Token": n,
						"X-Requested-With": "XMLHttpRequest",
						Accept: "application/json",
					},
					credentials: "include",
				})
			).ok;
		} catch {
			return !1;
		}
	}

	// Кнопка избранного
	async function setupFavoriteButton() {
		const JSON_HEADERS = {
			"X-Requested-With": "XMLHttpRequest",
			Accept: "application/json",
		};

		const FAVORITE_TEXT = {
			add: "Добавить в избранное",
			remove: "Удалить из избранного",
		};

		const fetchJSON = async (url) => {
			const response = await fetch(url, {
				method: "GET",
				headers: JSON_HEADERS,
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error(`Request failed: ${url}`);
			}

			return response.json();
		};

		const setButtonState = (button, isFavorite) => {
			const action = isFavorite ? "remove" : "add";

			button.classList.toggle("fav-add", !isFavorite);
			button.classList.toggle("fav-remove", isFavorite);

			button.setAttribute("title", FAVORITE_TEXT[action]);
			button.setAttribute("original-title", FAVORITE_TEXT[action]);

			if (button.hasAttribute("data-text")) {
				button.setAttribute("data-text", FAVORITE_TEXT[action]);
			}
		};

		const resolveFavoritesKey = (type, kind) => {
			if (type === "Person") {
				switch (kind) {
					case "Mangaka":
						return "mangakas";
					case "Seyu":
						return "seyu";
					case "Producer":
						return "producers";
					default:
						return "people";
				}
			}

			const base = type.toLowerCase();
			return base === "ranobe" ? base : `${base}s`;
		};

		let user;
		let favourites;

		try {
			user = await fetchJSON("/api/users/whoami");
			favourites = await fetchJSON(`/api/users/${user.id}/favourites`);
		} catch (error) {
			error(error.message);
			return;
		}

		const buttons = document.querySelectorAll(
			'a.b-subposter-action[data-remote="true"][href^="/api/favorites/"]',
		);

		buttons.forEach((button) => {
			const parts = button.getAttribute("href").split("/");
			const type = parts.at(-2);
			const id = Number(parts.at(-1));
			const kind = button.getAttribute("data-kind") || "";

			const key = resolveFavoritesKey(type, kind);
			const favList = favourites[key] || [];

			const isFavorite = favList.some((item) => item.id === id);
			setButtonState(button, isFavorite);

			button.addEventListener("click", async (e) => {
				e.preventDefault();

				const adding = button.classList.contains("fav-add");
				const success = adding
					? await add_favorite(type, id)
					: await delete_favorite(type, id);

				if (!success) {
					error("Failed to toggle favorite");
					return;
				}

				setButtonState(button, adding);
			});
		});
	}
	
	const setupUserRateHandlers = () => {
		// Используем делегирование: вешаем один слушатель на body
		document.body.addEventListener("click", async (e) => {
			// 1. КЛИК ПО СТРЕЛКЕ ИЛИ ТЕЛУ КНОПКИ (Открыть/Закрыть меню)
			const trigger = e.target.closest(".b-add_to_list .trigger");
			if (trigger) {
				e.preventDefault();
				e.stopPropagation();

				const container = trigger.closest(".b-add_to_list");
				const expanded = container.querySelector(".expanded-options");

				// Закрываем все остальные открытые меню
				document.querySelectorAll(".expanded-options").forEach((el) => {
					if (el !== expanded) el.style.display = "none";
					if (el !== expanded)
						el.closest(".b-add_to_list")?.classList.remove(
							"expanded",
						);
				});

				// Тогглим текущее
				const isVisible = expanded.style.display === "block";
				expanded.style.display = isVisible ? "none" : "block";
				container.classList.toggle("expanded", !isVisible);
				return;
			}

			// 2. КЛИК ПО ОПЦИИ (Смена статуса или Удаление)
			const option = e.target.closest(
				".b-add_to_list .expanded-options .option",
			);
			const directAdd = e.target.closest(
				".b-add_to_list .trigger .add-trigger",
			);

			const actionElement = option || directAdd;

			if (actionElement) {
				e.preventDefault();

				const container = actionElement.closest(".b-add_to_list");
				const form = container.querySelector("form");
				const expanded = container.querySelector(".expanded-options");

				const newStatus = actionElement.dataset.status;
				const targetType = form.querySelector(
					'input[name="user_rate[target_type]"]',
				).value;
				const targetId = form.querySelector(
					'input[name="user_rate[target_id]"]',
				).value;
				const userId = form.querySelector(
					'input[name="user_rate[user_id]"]',
				).value;

				const csrfToken = document.querySelector(
					'meta[name="csrf-token"]',
				)?.content;

				// --- ЛОГИКА УДАЛЕНИЯ ---
				if (newStatus === "delete") {
					const deleteUrl = form.getAttribute("action");

					// 1. Сбрасываем внешний вид на "Запланировано" (синяя кнопка)
					container.className = "b-add_to_list planned";
                    container.classList.remove("expanded"); // Убираем стрелочку вверх

					// 2. Восстанавливаем триггер "Добавить в список"
					const triggerDiv = container.querySelector(".trigger");
					triggerDiv.innerHTML = `
                    <div class="trigger-arrow"></div>
                    <div class="text add-trigger" data-status="planned">
                        <div class="plus"></div>
                        <span class="status-name" data-text="Добавить в список"></span>
                    </div>`;

                    // 3. ВОССТАНАВЛИВАЕМ СПИСОК ОПЦИЙ (Fix бага с пустым списком)
                    // Нам нужно вернуть список (Смотрю, В планах...), но БЕЗ кнопки удалить
                    const typeKey = targetType.toLowerCase();
                    const texts = STATUS_DATA[typeKey]; // Берем тексты из глобальной константы
                    
                    const optionsHtml = Object.keys(STATUS_CLASSES).map(key => `
                        <div class="option add-trigger" data-status="${key}">
                            <div class="text"><span class="status-name" data-text="${texts[key]}"></span></div>
                        </div>
                    `).join('');
                    
					container.querySelector(".expanded-options").innerHTML = optionsHtml;

                    // 4. Отправляем запрос на удаление
					fetch(deleteUrl, {
						method: "DELETE",
						headers: {
							"X-CSRF-Token": csrfToken,
							"Content-Type": "application/json",
						},
					}).then(() => {
						log(`Запись удалена: ${targetId}`);
						form.setAttribute("action", "/api/v2/user_rates");
					});

					if (expanded) expanded.style.display = "none";
					return;
				}

				// --- ЛОГИКА ДОБАВЛЕНИЯ / ИЗМЕНЕНИЯ ---

				// 1. Оптимистичное обновление UI
				Object.values(STATUS_CLASSES).forEach((c) =>
					container.classList.remove(c),
				);
				container.classList.add(STATUS_CLASSES[newStatus]);

				const typeKey = targetType.toLowerCase();
				const statusText = STATUS_DATA[typeKey][newStatus];

				const triggerDiv = container.querySelector(".trigger");
				if (triggerDiv.querySelector(".add-trigger")) {
					triggerDiv.innerHTML = `
                    <div class="trigger-arrow"></div>
                    <div class="edit-trigger">
                        <div class="edit"></div>
                        <div class="text"><span class="status-name" data-text="${statusText}"></span></div>
                    </div>`;
				} else {
					const textSpan = triggerDiv.querySelector(".status-name");
					if (textSpan) {
						textSpan.textContent = ""; 
						textSpan.dataset.text = statusText; 
					}
				}

				if (expanded) expanded.style.display = "none";
				container.classList.remove("expanded");

				// 2. Подготовка запроса
				const currentAction = form.getAttribute("action");
				const isPatch = currentAction.match(/\/(\d+)$/);

				const method = isPatch ? "PATCH" : "POST";
				const body = {
					user_rate: {
						user_id: userId,
						target_id: targetId,
						target_type: targetType,
						status: newStatus,
					},
				};

				try {
					const resp = await fetch(currentAction, {
						method: method,
						headers: {
							"Content-Type": "application/json",
							"X-CSRF-Token": csrfToken,
						},
						body: JSON.stringify(body),
					});

					if (!resp.ok) throw new Error("Network error");

					const data = await resp.json();

					if (method === "POST" && data.id) {
						form.setAttribute(
							"action",
							`/api/v2/user_rates/${data.id}`,
						);

						const optionsDiv =
							container.querySelector(".expanded-options");
						if (!optionsDiv.querySelector(".remove-trigger")) {
							const removeDiv = document.createElement("div");
							removeDiv.className = "option remove-trigger";
							removeDiv.dataset.status = "delete";
							removeDiv.innerHTML = `<div class="text"><span class="status-name" data-text="${STATUS_DATA.common.remove}"></span></div>`;
							optionsDiv.appendChild(removeDiv);
						}
					}
					log(`Статус обновлен: ${newStatus} (ID: ${data.id})`);
				} catch (err) {
					error("Ошибка обновления статуса", err);
				}
			}

			// 3. КЛИК СНАРУЖИ
			if (!e.target.closest(".b-add_to_list")) {
				document.querySelectorAll(".expanded-options").forEach((el) => {
					el.style.display = "none";
					el
						.closest(".b-add_to_list")
						?.classList.remove("expanded");
				});
			}
		});

		log("Обработчики UserRates (Universal) активированы");
	};
	
	/**
	 * @description Искусственно вызывает события загрузки страницы, чтобы "оживить" JS-компоненты Shikimori.
	 */
	const triggerPageLoadEvents = () => {
		log("⚡️ Вызываю события загрузки страницы (turbolinks:load)...");
		// Основное событие для Turbolinks
		document.dispatchEvent(new Event("turbolinks:load"));
		// Дополнительное стандартное событие на всякий случай
		document.dispatchEvent(new Event("DOMContentLoaded"));
		// Для совместимости со старыми версиями
		document.dispatchEvent(new Event("page:load"));
	};

	/**
	 * Credits: https://shikimori.one/forum/site/610497-shikiutils
	 * Injects into the .scores block.
	 */
	async function injectExtraScores() {
		// --- НАСТРОЙКИ ---
		const CFG = {
			showShikiAvg: true,
			showAniList: true,
			displayMode: "stars", // 'stars' или 'headline'
			labels: {
				shiki: "Средний балл Шикимори",
				anilist: "AniList",
				mal: "MyAnimeList",
			},
		};

		const scoreBlock = document.querySelector(".scores");
		if (!scoreBlock) return;

		const originalRate = scoreBlock.querySelector(".b-rate"); // Находим оригинальный блок

		if (
			originalRate &&
			!originalRate.classList.contains("shiki-average-score") &&
			!originalRate.classList.contains("anilist-average-score")
		) {
			// Проверяем, не добавили ли мы уже подпись
			if (!scoreBlock.querySelector(".mal-label")) {
				const labelP = document.createElement("p");
				labelP.className = "score mal-label";
				labelP.style.marginTop = "2px";
				labelP.style.fontSize = "12px";
				labelP.style.color = "#999";
				labelP.style.textAlign = "center";
				labelP.textContent = "Оценка MAL"; // Источник "дефолтной" оценки

				originalRate.insertAdjacentElement("afterend", labelP);
			}
		}

		// ==========================================
		// 1. SHIKIMORI (Расчет среднего)
		// ==========================================
		if (CFG.showShikiAvg) {
			const statsEl = document.querySelector("#rates_scores_stats");
			if (statsEl && statsEl.dataset.stats) {
				try {
					const stats = JSON.parse(statsEl.dataset.stats);
					let total = 0,
						sum = 0;

					// Универсальный парсинг (поддерживает и массивы массивов, и объекты)
					const entries = Array.isArray(stats)
						? stats
						: Object.entries(stats);

					for (const [s, c] of entries) {
						const score = Number(s);
						const count = Number(c);
						if (!isNaN(score) && !isNaN(count)) {
							sum += score * count;
							total += count;
						}
					}

					if (total > 0) {
						const avg = (sum / total).toFixed(2);

						// ВЫЗОВ НОВОЙ ФУНКЦИИ
						renderRating({
							container: scoreBlock,
							score: avg,
							key: "shiki",
							label: CFG.labels.shiki,
							mode: CFG.displayMode,
						});

						// (Опционально) Доп. инфо "Всего оценок"
						if (!statsEl.querySelector(".total-rates")) {
							const totalEl = document.createElement("div");
							totalEl.className = "total-rates";
							totalEl.style.cssText =
								"margin-top: 5px; color: #999; font-size: 11px; text-align: center;";
							totalEl.textContent = `Всего оценок: ${total}`;
							statsEl.appendChild(totalEl);
						}
					}
				} catch (e) {
					console.error("Shiki calc error:", e);
				}
			}
		}

		// ==========================================
		// 2. ANILIST (Запрос к API)
		// ==========================================
		if (CFG.showAniList) {
			// Поиск названия
			const nameElement =
				document.querySelector('meta[property="og:title"]') ||
				document.querySelector(
					'.b-breadcrumbs .b-link[href*="/animes/"] span',
				);

			let searchTitle = nameElement
				? nameElement.getAttribute("content")
				: document.title;
			// Очистка от "RuName / EnName"
			if (searchTitle.includes("/"))
				searchTitle = searchTitle.split("/")[1].trim();

			if (searchTitle) {
				const isManga =
					location.pathname.includes("/mangas/") ||
					location.pathname.includes("/ranobe/");
				const type = isManga ? "MANGA" : "ANIME";

				const query = `query ($search: String) { Media(search: $search, type: ${type}) { averageScore } }`;

				try {
					const res = await fetch("https://graphql.anilist.co", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify({
							query,
							variables: { search: searchTitle },
						}),
					});

					const data = await res.json();
					const aniScoreRaw = data?.data?.Media?.averageScore;

					if (aniScoreRaw) {
						const aniScore = (aniScoreRaw / 10).toFixed(2); // 100 -> 10.0

						// ВЫЗОВ НОВОЙ ФУНКЦИИ
						renderRating({
							container: scoreBlock,
							score: aniScore,
							key: "anilist",
							label: CFG.labels.anilist,
							mode: CFG.displayMode,
						});
					}
				} catch (e) {
					console.error("AniList Fetch Error:", e);
				}
			}
		}
	}

	/**
	 * Credits: https://shikimori.one/forum/site/610497-shikiutils
	 * Calculates total watch time based on episodes and duration.
	 */
	function injectWatchTime() {
		// --- SETTINGS ---
		const CFG = {
			enabled: true,
			template: "Всего времени:",
		};

		if (!CFG.enabled) return;

		// Helper: Pluralization (день, дня, дней)
		const getPluralForm = (number, one, two, five) => {
			const n = Math.abs(number);
			const n1 = n % 10;
			const n2 = n % 100;
			if (n2 > 10 && n2 < 20) return five;
			if (n1 > 1 && n1 < 5) return two;
			if (n1 === 1) return one;
			return five;
		};

		// Helper: Parse duration string
		const parseDur = (text) => {
			const t = text.toLowerCase();
			const h = /(\d+)\s*(?:час|hour)/.exec(t);
			const m = /(\d+)\s*(?:мин|min)/.exec(t);
			return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
		};

		// Helper: Format minutes to string
		const formatTime = (totalMins) => {
			const days = Math.floor(totalMins / 1440);
			const hours = Math.floor((totalMins % 1440) / 60);
			const mins = totalMins % 60;

			const parts = [];
			if (days > 0)
				parts.push(
					`${days} ${getPluralForm(days, "день", "дня", "дней")}`,
				);
			if (hours > 0)
				parts.push(
					`${hours} ${getPluralForm(hours, "час", "часа", "часов")}`,
				);
			if (mins > 0)
				parts.push(
					`${mins} ${getPluralForm(
						mins,
						"минута",
						"минуты",
						"минут",
					)}`,
				);
			return parts.join(", ");
		};

		try {
			const infoBlock = document.querySelector(".b-entry-info");
			if (!infoBlock) return;

			// Find necessary lines by key text
			const findLine = (...keys) => {
				const lines = infoBlock.querySelectorAll(
					".line-container .line",
				);
				for (let line of lines) {
					const keyEl = line.querySelector(".key");
					if (!keyEl) continue;
					if (
						keys.some((k) =>
							keyEl.textContent
								.toLowerCase()
								.includes(k.toLowerCase()),
						)
					) {
						return line;
					}
				}
				return null;
			};

			const epLine = findLine("Эпизоды", "Episodes");
			const durLine = findLine("Длительность", "Duration");

			if (!epLine) return;

			const epValue = parseInt(
				epLine.querySelector(".value")?.textContent.trim(),
			);
			const durText = durLine
				? durLine.querySelector(".value")?.textContent.trim()
				: "0 мин";
			const durMins = parseDur(durText);

			if (!epValue || !durMins) return;

			const totalTime = epValue * durMins;

			// Prevent duplicates
			if (!document.querySelector(".time-block")) {
				const timeBlock = document.createElement("div");
				timeBlock.className = "line-container time-block"; // Matches template structure
				timeBlock.innerHTML = `
                    <div class="line">
                        <div class="key">${CFG.template}</div>
                        <div class="value">${formatTime(totalTime)}</div>
                    </div>`;

				// Insert after duration or at the end of block
				if (durLine) {
					durLine.closest(".line-container").after(timeBlock);
				} else {
					infoBlock.appendChild(timeBlock);
				}
			}
		} catch (err) {
			error("WatchTime Error:", err);
		}
	}

	/**
	 * Credits: https://shikimori.one/forum/site/610497-shikiutils
	 * 1. Calculates average score for "Friends" or "Statuses" bars.
	 * 2. Fetches detailed info (episodes/chapters) for friends in the list.
	 */
	async function enhanceSidebarStats() {
		const CFG = {
			calcAvg: true, // Считать среднее по полоскам
			fetchDetails: true, // Грузить эпизоды друзей
			avgTemplate: "Средний балл: {avg}",
			showZero: true, // Показывать (0 эп.)
		};

		// --- 1. Average Score Calculation (Generic) ---
		if (CFG.calcAvg) {
			document
				.querySelectorAll(".bar.simple.horizontal")
				.forEach((barBlock) => {
					// Find the subheadline relative to this bar
					const parentBlock = barBlock.closest(".block");
					const head = parentBlock
						? parentBlock.querySelector(".subheadline")
						: null;

					if (head && head.querySelector("[data-avg-added]")) return; // Skip if done

					let sum = 0,
						total = 0;
					let hasScore = false;

					// Try to parse scores from lines (works for "Friends" block if scores are visible like "10")
					// Or from graph bars (works for "User Ratings")
					barBlock.querySelectorAll(".line").forEach((line) => {
						// Try getting score from label (User rates graph)
						let score = parseInt(
							line.querySelector(".x_label")?.textContent,
						);
						let count = 0;

						// If not found, try getting from text (Friends list: "Watching - 10")
						if (isNaN(score)) {
							const statusText = line.textContent;
							const match = statusText.match(/–\s*(\d+)/);
							if (match) {
								score = parseInt(match[1]);
								count = 1; // Each line is 1 friend
							}
						} else {
							// It's a graph bar
							const bar = line.querySelector(".bar");
							count =
								parseInt(bar?.getAttribute("title")) ||
								parseInt(
									bar?.querySelector(".value")?.textContent,
								);
						}

						if (!isNaN(score) && !isNaN(count) && count > 0) {
							sum += score * count;
							total += count;
							hasScore = true;
						}
					});

					if (hasScore && total > 0) {
						const avg = (sum / total).toFixed(2);

						// Inject into headline
						if (head) {
							const marker = document.createElement("span");
							marker.dataset.avgAdded = "true";
							marker.style.fontSize = "12px";
							marker.style.color = "#888";
							marker.style.marginLeft = "10px";
							marker.textContent = `(${avg})`;
							head.appendChild(marker);
						}
					}
				});
		}

		// --- 2. Fetch Detailed Friend Info ---
		if (CFG.fetchDetails) {
			// Need to know WHO we are checking.
			// Try to get IDs from URL or DOM.
			const path = window.location.pathname;
			const animeMatch = path.match(/\/(animes|mangas|ranobe)\/(\d+)/);
			if (!animeMatch) return;

			const targetId = animeMatch[2];
			const isManga =
				path.includes("/mangas/") || path.includes("/ranobe/");
			const targetType = isManga ? "Manga" : "Anime";

			// Find friends block
			const friendsBlock = document.querySelector(
				".b-animes-menu .block",
			);
			// Note: In 404Fix script, this might be the "If you know how to return..." placeholder.
			// The logic below only works if there are actual friend lines.
			if (!friendsBlock) return;

			const friendLines = Array.from(
				friendsBlock.querySelectorAll(
					".b-menu-line.friend-rate, .b-show_more-more .friend-rate",
				),
			);
			if (friendLines.length === 0) return;

			// Get Current User ID for API context?
			// Actually we need the FRIEND'S ID.
			// Standard Shikimori renders friend link as <a href="/nickname" title="nickname">
			// We need to resolve nickname -> ID.

			// Let's try to get ID from avatar image URL (often contains ID) or we have to fetch profile.

			for (const line of friendLines) {
				const userLink = line.querySelector(
					`a[href^='${CONFIG.SITE_NAME}/']`,
				); // or internal link
				if (!userLink) continue;

				// Extract ID from avatar if possible to save a request
				// src=".../users/x48/12345.png"
				const img = line.querySelector("img");
				let friendId = null;
				if (img && img.src) {
					const m = img.src.match(/\/users\/[a-z0-9]+\/(\d+)\./);
					if (m) friendId = m[1];
				}

				// If we have ID, fetch rates
				if (friendId) {
					try {
						const userRates = await apiRequest(
							`/v2/user_rates?user_id=${friendId}&target_type=${targetType}&target_id=${targetId}`,
						);
						// API returns array. Should be 1 item since we filtered by target_id
						const rate = userRates[0];

						if (rate) {
							const statusEl = line.querySelector(".status"); // Assuming standard structure
							if (statusEl) {
								let text = statusEl.textContent
									.split("–")[0]
									.trim(); // "Смотрю"

								if (rate.score > 0) text += ` – ${rate.score}`;

								const progress = isManga
									? rate.chapters
									: rate.episodes;
								if (
									progress > 0 ||
									(progress === 0 && CFG.showZero)
								) {
									text += ` (${progress} ${
										isManga ? "гл." : "эп."
									})`;
								}

								statusEl.textContent = text;
							}
						}
					} catch (e) {
						error(`Failed to fetch rate for friend ${friendId}`, e);
					}
				}
			}
		}
	}

	/**
	 * @description Загружает и выполняет все скрипты Shikimori с донорской страницы
	 *              для полной активации всех компонентов.
	 */
	const executeShikimoriScripts = async () => {
		try {
			log("🚀 Загрузка и выполнение скриптов Shikimori...");

			// 1. Запрашиваем донорскую страницу снова (или используем кэш)
			const response = await fetch(CONFIG.DONOR_URL);
			const html = await response.text();

			// 2. Парсим HTML
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// 3. Находим все скрипты из /packs/js/ (основные скрипты Shikimori)
			const scripts = doc.querySelectorAll('script[src*="/packs/js/"]');

			// 4. Загружаем и выполняем каждый скрипт
			for (const script of scripts) {
				const src = script.src;
				if (!src) continue;

				try {
					log(`📜 Загружаю скрипт: ${src}`);

					// Создаем новый script элемент
					const newScript = document.createElement("script");
					newScript.src = src.startsWith("http")
						? src
						: `${CONFIG.SITE_NAME}${src}`;
					newScript.type = "application/javascript";
					newScript.async = false; // Важно для порядка выполнения

					// Добавляем в head
					document.head.appendChild(newScript);

					// Ждем загрузки скрипта
					await new Promise((resolve, reject) => {
						newScript.onload = resolve;
						newScript.onerror = reject;
					});

					log(`✅ Скрипт загружен: ${src}`);
				} catch (err) {
					error(`❌ Ошибка загрузки скрипта ${src}:`, err.message);
				}
			}

			// 5. Также выполняем inline скрипты (если есть)
			const inlineScripts = doc.querySelectorAll("script:not([src])");
			for (const script of inlineScripts) {
				try {
					if (script.textContent.trim()) {
						log("📜 Выполняю inline-скрипт...");
						eval(script.textContent); // Осторожно! Но это скрипты Shikimori
					}
				} catch (err) {
					error("❌ Ошибка выполнения inline-скрипта:", err.message);
				}
			}

			log("✅ Все скрипты Shikimori загружены и выполнены");
		} catch (err) {
			error("❌ Ошибка при загрузке скриптов Shikimori:", err);
		}
	};

	// --- Основная логика ---
	let renderEntityPage = async (id, type) => {
		const startTime = performance.now();
		try {
			// const templateUrl = CONFIG.TEMPLATE_URL;

			const [pageData, currentUser, /*htmlText*/ pageAssets] =
				await Promise.all([
					getEntityData(id, type),
					getCurrentUser(),
					// fetch(templateUrl).then(res => res.text()),
					getPageAssets(),
				]);

			// Передаем все ассеты в основной объект данных
			pageData.ASSETS = pageAssets;

			// Если пользователь есть, добавляем его данные и ЗАПРАШИВАЕМ ЕГО СТИЛЬ
			if (currentUser) {
				pageData.USER = currentUser;
				// Запрашиваем CSS и добавляем его в pageData
				pageData.USER_CSS = await getUserStyle(currentUser.USER_ID);
			} else {
				pageData.USER_CSS = null;
			}

			const renderedHTML = renderTemplate(ANIME_HTML_TEMPLATE, pageData);

			hideLoader();

			/* В будущем эти 3 строки могут сломаться */
			document.open();
			document.write(renderedHTML);
			document.close();

			setTimeout(async () => {
				triggerPageLoadEvents();
				setupReplyButtons();
				setupQuoteButtons();
				setupShowMoreHandlers();
				setupFavoriteButton();
				setupUserRateHandlers();

				// Загружаем и выполняем скрипты Shikimori
				// await executeShikimoriScripts();

				// Инициализируем наши обработчики (они могут переопределить стандартные)
				// setupAddToListButtons();

				injectExtraScores();
				injectWatchTime();
				enhanceSidebarStats();
			}, 150);

			// --- Если сломается, комментируйте 3 строки вверху и меняйте на это ---
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
			// --- ВНИМАНИЕ, ^ ПОДХОД НЕ ПАНАЦЕЯ!
			// --- При тестировании, у разработчиков возникали серьёзные проблемы с функционалом.

			setTimeout(triggerPageLoadEvents, 0);
		} catch (e) {
			error(`Ошибка при рендере страницы для аниме ID ${id}:`, e.message);
			error(e.stack);
			document.body.innerHTML = `<div class="b-dialog"><div class="inner"><h1>Error</h1><p>${e.message}</p></div></div>`;
			document.body.innerHTML += `<div class="b-dialog"><div class="inner"><h2>Stack</h2><p>${e.stack}</p></div></div>`;
		} finally {
			const endTime = performance.now();
			const duration = (endTime - startTime).toFixed(2);
			log(`✅ Страница полностью отрисована за ${duration} мс.`);
		}
	};

	// Ручное востоновление
	// пример: restorePage(855, "anime")
	window.restorePage = async (id, type) => {
		renderEntityPage(id, type);
		log(`🔄 Ручное восстановление ${type} ID: ${id}`);
	};

	const init = () => {
		// Существующий код проверки 404 страницы
		if (document.title.trim() !== "404") return;

		const match = location.pathname.match(/\/(animes|mangas)\/([a-z0-9]+)/);
		if (!match) return;

		const typePlural = match[1];
		let id = match[2];
		id = id.replace(/\D/g, "");
		const type = typePlural.slice(0, -1);

		showLoader();
		renderEntityPage(id, type);
	};

	// ================================
	// ОБРАБОТЧИКИ ДЛЯ TURBOLINKS/PJAX
	// ================================
	document.addEventListener("page:load", init);
	document.addEventListener("turbolinks:load", init);

	// Запуск при обычной загрузке
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		// Если страница уже загружена
		init();
	}
})();
