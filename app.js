$(function () {
  const API_BASE_URL = "https://freedict.com/api/v1";
  const REVIEW_KEY = "quizletReviewWords";
  const API_KEY = 'fd_53cd00d36c2a5820bcf910192b69a87aef8fd4c8fc7c33bf';
  let cards = [];
  let position = 0;
  let mastered = 0; 
  let mistakes = 0;
  let originalCount = 0;
  let unlearned = new Map();
  let locked = false;

  function readList(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }

  async function translateWord(word) {
    const params = new URLSearchParams({ q: word, langpair: "en|uk" });
    const response = await fetch("https://api.mymemory.translated.net/get?" + params);
    if (!response.ok) return "";
    const result = await response.json();
    return result.responseData?.translatedText || "";
  }

  async function startStudy() {
    const name = $("#name").val().trim();
    const apiKey = API_KEY
    const level = $("#level").val().toLowerCase();
    const topic = $("#topic").val();
    const amount = Number($("#amount").val());
    if (!name || !apiKey || !Number.isInteger(amount) || amount < 1 || amount > 100) {
      $("#status").text("Вкажи ім’я, API-ключ і кількість слів від 1 до 100.");
      return;
    }

    $("#start").prop("disabled", true);
    $("#status").text("Завантажую слова з бекенду…");
    try {
      async function requestWords(withTopic) {
        const filters = { cefr_level: level, limit: String(amount) };
        if (withTopic) filters.meaning = topic;
        const params = new URLSearchParams(filters);
        const response = await fetch(API_BASE_URL + "/words?" + params, {
          headers: { "X-API-Key": apiKey }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || result.error?.code || "HTTP " + response.status);
        const data = result.data;
        return Array.isArray(data) ? data : (data?.results || data?.words || result.results || []);
      }

      let fetchedWords = await requestWords(true);
      if (!fetchedWords.length) fetchedWords = await requestWords(false);
      const words = [];
      for (const item of fetchedWords) {
        const word = item.word || item.slug;
        if (!word) continue;
        let translation = "";
        try { translation = await translateWord(word); } catch { }
        words.push({
          word,
          definition: item.definition_short || item.definition || "Визначення відсутнє.",
          translation
        });
      }
      const reviewWords = readList(REVIEW_KEY);
      localStorage.removeItem(REVIEW_KEY);
      cards = [...reviewWords, ...words.filter(Boolean)];
      cards = cards.filter((item, index) => cards.findIndex(other => other.word.toLowerCase() === item.word.toLowerCase()) === index);
      if (!cards.length) throw new Error("API не повернуло слів для цього рівня.");

      position = 0;
      mastered = 0;
      mistakes = 0;
      originalCount = cards.length;
      unlearned = new Map();
      $("#greeting").text("Привіт, " + name + "!");
      $("#setup, #addPanel").hide();
      $("#study").show();
      showCard();
    } catch (error) {
      $("#status").text("FreeDict: " + error.message);
      $("#start").prop("disabled", false);
    }
  }

  function showCard() {
    locked = false;
    const card = cards[position];
    $("#step").text((position + 1) + " / " + cards.length);
    $("#progress").css("width", (mastered / originalCount * 100) + "%");
    $("#card").removeClass("revealed correct incorrect").text("Натисни, щоб побачити слово");
    $("#definition").text((card.translation ? "Переклад: " + card.translation + ". " : "") + "Визначення: " + card.definition);
    $("#answer").val("").focus();
    $("#feedback").text("");
    $("#check").show();
    $("#score").text("Вивчено: " + mastered + " / " + originalCount + " · Помилки: " + mistakes);
    $("#unlearned").text("Невивчені слова: " + [...unlearned.keys()].join(", "));
  }

  function finishStudy() {
    const missed = [...unlearned.keys()];
    alert("Вивчено " + mastered + " із " + originalCount + ". " +
      (missed.length ? "Невивчені слова: " + missed.join(", ") : "Усі слова вивчені!") +
      " Помилок: " + mistakes + ".");
    location.reload();
  }

  function moveOn(card, isCorrect) {
    if (isCorrect) {
      mastered++;
      unlearned.delete(card.word);
    } else {
      mistakes++;
      unlearned.set(card.word, card);
      cards.push(card);
    }
    position++;
    if (mastered === originalCount) finishStudy();
    else showCard();
  }

  function checkAnswer() {
    if (locked || !cards[position]) return;
    locked = true;
    const card = cards[position];
    const isCorrect = $("#answer").val().trim().toLowerCase() === card.word.toLowerCase();
    $("#card").removeClass("revealed").addClass(isCorrect ? "correct" : "incorrect").text(card.word);
    $("#feedback").text(isCorrect ? "Правильно!" : "Правильна відповідь: " + card.word);
    $("#check").hide();
    setTimeout(() => moveOn(card, isCorrect), 800);
  }

  $("#start").on("click", startStudy);
  $("#check").on("click", checkAnswer);
  $("#finish").on("click", finishStudy);
  $("#answer").on("keydown", event => { if (event.key === "Enter") checkAnswer(); });
  $("#card").on("click", function () {
    if (locked || !cards[position]) return;
    locked = true;
    const card = cards[position];
    $(this).addClass("revealed").text(card.word);
    $("#feedback").text("Додано до невивчених — слово повернеться в чергу.");
    $("#check").hide();
    setTimeout(() => moveOn(card, false), 650);
  });

});
