function normalizeAnswer(answer) {
  return answer.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export function answersMatch(received, expected) {
  return normalizeAnswer(received) === normalizeAnswer(expected);
}
