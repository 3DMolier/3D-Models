#!/bin/bash
# deploy-push.sh — отправка коммитов на origin с учётом Action'а авто-минификации.
#
# Зачем отдельный скрипт: в репозитории висит GitHub Action, который после каждого
# нашего пуша добавляет свой коммит «chore: auto-minify CSS and JS». Из-за него
# следующий обычный `git push` всегда падает с non-fast-forward. Руками это каждый
# раз разбирать бессмысленно — здесь fetch, слияние и пуш одной командой.
#
# Правила репозитория соблюдены: никакого `git add .`, файлы добавляются заранее,
# скрипт только коммитит уже подготовленный индекс и отправляет.
#
# Запуск:  bash scripts/deploy-push.sh                    отправить готовые коммиты
#          bash scripts/deploy-push.sh путь/к/сообщению   сперва закоммитить индекс
#
# Всегда запускать в фоне: коммит в этом репозитории идёт около 10 минут.

set -u
cd "D:/3d/документы/Blogger/Clode_and_Gpt_Website" || exit 1
MSG_FILE="${1:-}"

say () { echo "[$(date +%H:%M:%S)] $*"; }

# Остаточный замок снимаем ТОЛЬКО убедившись, что процесса git нет:
# иначе можно снести замок работающей операции и получить битый индекс.
# Проверка живого git через tasklist, а НЕ через `ps -W | grep git.exe`.
# 06.08.2026 ps не показал работающий git (PID 32180, 23 c процессорного времени),
# скрипт счёл замок остаточным и попытался снести замок ИДУЩЕГО коммита. Спасло
# только то, что Windows держал файл занятым. Ошибиться здесь — значит получить
# битый индекс на 87 тысяч файлов.
git_running () {
  tasklist //FI "IMAGENAME eq git.exe" //NH 2>/dev/null | grep -qi "git.exe"
}

# Ждём освобождения, а не падаем сразу: коммит в этом репозитории идёт около 10 минут,
# и параллельный запуск раньше приводил к «index.lock: File exists» после шести минут
# работы впустую.
for i in $(seq 1 60); do
  [ -f .git/index.lock ] || break
  if git_running; then
    say "git занят, жду освобождения ($i/60)"
    sleep 30
  else
    # Даже без видимого процесса файл может быть занят — тогда это не остаточный
    # замок, а незакрытый дескриптор. Сносить нельзя, ждём дальше.
    if rm -f .git/index.lock 2>/dev/null && [ ! -f .git/index.lock ]; then
      say "замок остаточный, процесса git нет — снял"
      break
    fi
    say "замок занят системой, процесса не видно — жду ($i/60)"
    sleep 30
  fi
done
if [ -f .git/index.lock ]; then
  say "ОСТАНОВКА: замок держится больше 30 минут, нужен ручной разбор"; exit 1
fi

if [ -n "$MSG_FILE" ]; then
  n=$(git diff --cached --name-only | wc -l)
  if [ "$n" -eq 0 ]; then
    say "индекс пуст, коммитить нечего"
  else
    say "коммичу $n файлов"
    git commit -q -F "$MSG_FILE" || { say "ОШИБКА commit"; exit 1; }
    say "коммит: $(git log --oneline -1)"
  fi
fi

ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo '?')
say "к отправке коммитов: $ahead"

for attempt in 1 2 3; do
  say "попытка $attempt: пуш"
  if git push origin HEAD:refs/heads/main 2>&1 | tee /tmp/push.$$ | tail -3; then
    if ! grep -q "rejected" /tmp/push.$$; then
      rm -f /tmp/push.$$
      say "ГОТОВО: на origin $(git ls-remote origin refs/heads/main | cut -c1-10)"
      echo "DEPLOY-PUSH-OK"
      exit 0
    fi
  fi
  rm -f /tmp/push.$$
  say "отклонено — подтягиваю коммит Action'а и сливаю"
  git fetch origin 2>&1 | tail -1
  git merge origin/main -m "merge: коммит авто-минификации с origin" 2>&1 | tail -2 \
    || { say "ОШИБКА merge — нужен ручной разбор"; exit 1; }
done

say "не удалось отправить за 3 попытки"
exit 1
