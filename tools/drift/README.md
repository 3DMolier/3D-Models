# SEO drift monitoring — 3dmolierstudio.com

Два слоя слепка на одну и ту же выборку из 13 страниц (главная, catalog/full-catalog/browse,
collections, 3 хаба категорий, 2 объединённые карточки, 3 обычные карточки из разных категорий).

## 1. Общий слепок (title/description/canonical/robots/H1/H2/H3/OG/JSON-LD/статус)

Хранится в SQLite: `~/.cache/claude-seo/drift/baselines.db` (13 baseline-записей, id 1-13).

Сравнение одной страницы:
```
"$HOME/.claude/skills/seo/bin/claude-seo" run drift_compare.py https://3dmolierstudio.com/models/k9-thunder-self-propelled-howitzer-2219454/
```
История:
```
"$HOME/.claude/skills/seo/bin/claude-seo" run drift_history.py https://3dmolierstudio.com/models/k9-thunder-self-propelled-howitzer-2219454/
```

## 2. Кастомный слепок (специфика каталога 3DMolier)

Общий инструмент не видит таблицу характеристик, хлебные крошки, блок "All Versions of This
Model" и блок похожих моделей. Эти элементы снимает `custom_checks.py`, слепок лежит в
`baseline.json` рядом со скриптом.

Сравнение той же выборки:
```
python "D:\3d\документы\Blogger\Clode_and_Gpt_Website\tools\drift\custom_checks.py" compare <url1> <url2> ...
```
(список URL — см. `baseline.json`, ключи верхнего уровня)

Досъёмка новой страницы в тот же файл:
```
python "D:\3d\документы\Blogger\Clode_and_Gpt_Website\tools\drift\custom_checks.py" baseline <url> --out "D:\3d\документы\Blogger\Clode_and_Gpt_Website\tools\drift\baseline.json"
```

## Регрессионный тест на двух реальных инцидентах

```
python "D:\3d\документы\Blogger\Clode_and_Gpt_Website\tools\drift\custom_checks.py" selftest
```
Берёт реальную карточку из `models/`, искусственно портит её в памяти (не трогая файл на диске)
двумя способами и проверяет, что сравнение ловит обе поломки:
- открывающий тег таблицы характеристик заменён на литерал `$1` → `custom_spec_table_broken` (CRITICAL);
- дублирование "3D Model" в `<title>` → `custom_title_malformed` (CRITICAL).

Общий 17-правильный набор (`drift_compare.py`) эти два случая не ловит: для таблицы
характеристик там вообще нет отдельного элемента слепка, а изменение `<title>` он видит только
как generic `title_changed` (WARNING, "мониторь CTR 2 недели") — то есть отличает "текст title
изменился" от "title сломан дублированием/обрывком тега" не умеет.
