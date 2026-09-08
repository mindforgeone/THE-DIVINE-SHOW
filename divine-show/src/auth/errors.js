export function authErrorMessage(error) {
  const messages = {
    'auth/popup-blocked': 'Браузер заблокировал окно Google. Разреши всплывающие окна для этого сайта. Если ссылка открыта внутри другого приложения, открой её в Safari или Chrome.',
    'auth/popup-closed-by-user': 'Окно Google закрылось до завершения входа. Нажми «Войти через Google» ещё раз и дождись возвращения в марафон.',
    'auth/cancelled-popup-request': 'Предыдущая попытка входа отменена. Попробуй ещё раз, оставив одно окно Google.',
    'auth/network-request-failed': 'Не удалось связаться с Google. Проверь подключение и попробуй войти ещё раз.',
    'auth/web-storage-unsupported': 'Браузер не разрешает сохранять вход. Открой сайт в обычной вкладке Safari или Chrome и разреши хранение данных сайта.',
    'auth/unauthorized-domain': 'Этот адрес сайта не разрешён в настройках входа Firebase. Открой основной адрес марафона.',
    'auth/operation-not-supported-in-this-environment': 'В этом браузере вход недоступен. Открой ссылку в Safari или Chrome, вне встроенного браузера другого приложения.',
    'auth/operation-not-allowed': 'Вход через Google отключён в настройках Firebase. Требуется проверка настроек проекта.',
    'auth/user-disabled': 'Доступ к этому аккаунту отключён в Firebase. Требуется проверка аккаунта.',
    'auth/user-token-expired': 'Сессия аккаунта истекла. Войди через Google ещё раз. Облачная история сохранится.',
    'auth/invalid-user-token': 'Нужно заново подтвердить вход через Google. Облачная история сохранится.',
    'auth/too-many-requests': 'Слишком много попыток входа подряд. Подожди немного и попробуй ещё раз.',
  };
  return messages[error?.code] || 'Не удалось завершить вход через Google. Попробуй ещё раз в обычной вкладке Safari или Chrome.';
}

export function historyErrorMessage(error) {
  const code = error?.code?.replace('firestore/', '');
  if (code === 'permission-denied') return 'Вход в Google выполнен, но Firebase не разрешает читать историю. Требуется проверка правил доступа. Новый марафон не создан.';
  if (code === 'unauthenticated') return 'Вход в Google выполнен, но облако не подтвердило сессию. Повтори загрузку. Если ошибка останется, выйди и войди снова.';
  return 'Не удалось загрузить облачную историю. Аккаунт остаётся подключён. Проверь интернет и повтори загрузку.';
}
