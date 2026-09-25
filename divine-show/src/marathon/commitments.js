export const COMMITMENT_VERSION = 1;

export const START_COMMITMENTS = [
  {
    id: 'alcohol', title: 'Без алкоголя весь марафон', metric: '0 порций · каждый день',
    text: 'Я выбираю не пить алкоголь в течение марафона, включая праздники и встречи. Заранее выбираю безалкогольную альтернативу.',
  },
  {
    id: 'sweets', title: 'Свобода от привычки к сладостям', metric: '0 сладостей · каждый день',
    text: 'Я отказываюсь от сладостей, сладких напитков и десертов-заменителей, включая протеиновые печенья. Обычная полноценная еда остаётся частью заботы о теле.',
  },
  {
    id: 'nutrition', title: 'Питание, которое поддерживает тело', metric: 'Вес · питание · активность · шаги',
    text: 'Я записываю съеденное и активность, ориентируюсь на свой план питания и движение к 65 кг. Я ем регулярно и достаточно: не компенсирую отклонения голоданием или изнурением.',
  },
  {
    id: 'action', title: 'Каждый день — действие к цели', metric: 'Минимум 1 конкретное действие в день',
    text: 'Я делаю хотя бы один посильный шаг в работе, навыках, физической форме или самовыражении. Записываю, что именно сделал. Размер шага можно уменьшить, его смысл должен остаться.',
  },
  {
    id: 'honesty', title: 'Рост, который можно увидеть', metric: 'Факты каждый день · итог каждые 7 дней',
    text: 'Я честно отмечаю и выполненное, и отклонения. Каждые 7 дней смотрю на факты и выбираю следующий шаг. Если отклонился, возвращаюсь к плану со следующего действия.',
  },
  {
    id: 'respect', title: 'Я на своей стороне', metric: 'Дисциплина с уважением к себе',
    text: 'Я уже ценен. Моя ценность не зависит от веса, очков и чужих результатов. Я тренирую привычки без унижения себя и принимаю помощь, когда она нужна.',
  },
];

export function commitmentsForDuration(durationDays = 120) {
  const duration = [30, 90, 120].includes(Number(durationDays)) ? Number(durationDays) : 120;
  return START_COMMITMENTS.map((item) => item.id === 'alcohol'
    ? { ...item, title: `${duration} дней без алкоголя` }
    : item.id === 'honesty'
      ? { ...item, metric: `${duration} дней фактов · итог каждые 7 дней` }
      : item);
}

export function memberCommitmentsForDuration(durationDays = 120) {
  const duration = [30, 90, 120].includes(Number(durationDays)) ? Number(durationDays) : 120;
  return [
    { id: 'honesty', title: 'Отмечать факты честно', metric: `${duration} дней реальных данных`, text: 'Я отмечаю выполненное и невыполненное без попытки понравиться рейтингу. Этот путь нужен прежде всего мне.' },
    { id: 'nutrition', title: 'Следовать своему плану питания', metric: 'Калории и выбор питания', text: 'Я заранее выбираю посильный план, не компенсирую отклонения голоданием и меняю лимит, если он перестал быть безопасным.' },
    { id: 'movement', title: 'Двигаться в своём темпе', metric: 'Активность и шаги, если считаю их', text: 'Я выбираю доступную активность. Если у меня нет трекера, приложение не будет требовать активные калории.' },
    { id: 'measurements', title: 'Смотреть на динамику, а не на один день', metric: 'Вес, замеры и фото по желанию', text: 'Я сравниваю точки в одинаковых условиях и не делаю вывод о себе по случайному колебанию веса.' },
    { id: 'rules', title: 'Собрать собственный Кодекс', metric: 'Только мои измеримые правила', text: 'Я могу добавить, скрыть или завершить правило. История останется в статистике с даты, когда правило действовало.' },
    { id: 'respect', title: 'Оставаться на своей стороне', metric: 'Дисциплина без унижения', text: 'Результат дня описывает действия, а не мою ценность. После отклонения следующий полезный выбор начинается сразу.' },
  ];
}

export function acceptCommitments(checked, purpose, acceptedAt, durationDays = 120) {
  const items = commitmentsForDuration(durationDays);
  if (!items.every((item) => checked?.[item.id] === true) || purpose?.trim().length < 10 || !purpose?.trim()) return null;
  return { version: COMMITMENT_VERSION, acceptedAt, purpose: purpose.trim(), items: items.map((item) => ({ ...item, accepted: true })) };
}

export function acceptMemberCommitments(checked, purpose, acceptedAt, durationDays = 120) {
  const items = memberCommitmentsForDuration(durationDays);
  if (!items.every((item) => checked?.[item.id] === true) || purpose?.trim().length < 10 || !purpose?.trim()) return null;
  return { version: COMMITMENT_VERSION, acceptedAt, purpose: purpose.trim(), items: items.map((item) => ({ ...item, accepted: true })) };
}
