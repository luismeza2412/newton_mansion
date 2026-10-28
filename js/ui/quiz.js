/**
 * Modal de explicación + quiz que se muestra tras completar un nivel
 * (RF-50 a RF-53). Namespace: NM.quiz
 */
(function () {
  'use strict';

  var modalRoot, explanationPanel, quizPanel;
  var lawNameEl, lawStatementEl, lawFormulaEl, lawExampleEl, continueButton;
  var questionEl, optionsEl, feedbackEl, nextButton;
  var pendingDone = null;
  var answered = false;

  function queryDom() {
    modalRoot = document.querySelector('[data-modal="lesson"]');
    explanationPanel = modalRoot.querySelector('[data-lesson="explanation"]');
    quizPanel = modalRoot.querySelector('[data-lesson="quiz"]');
    lawNameEl = modalRoot.querySelector('[data-lesson="law-name"]');
    lawStatementEl = modalRoot.querySelector('[data-lesson="law-statement"]');
    lawFormulaEl = modalRoot.querySelector('[data-lesson="law-formula"]');
    lawExampleEl = modalRoot.querySelector('[data-lesson="law-example"]');
    continueButton = modalRoot.querySelector('[data-lesson="continue-quiz"]');
    questionEl = modalRoot.querySelector('[data-lesson="quiz-question"]');
    optionsEl = modalRoot.querySelector('[data-lesson="quiz-options"]');
    feedbackEl = modalRoot.querySelector('[data-lesson="quiz-feedback"]');
    nextButton = modalRoot.querySelector('[data-lesson="next-level"]');
  }

  function renderExplanation(law) {
    lawNameEl.textContent = law.name;
    lawStatementEl.textContent = law.statement;
    lawFormulaEl.textContent = law.formula;
    lawExampleEl.textContent = 'Ejemplo: ' + law.example;
  }

  function optionMarkup(text, index) {
    return '<button type="button" class="quiz__option" data-quiz-option="' + index + '">' + text + '</button>';
  }

  function renderQuizQuestion(quiz) {
    questionEl.textContent = quiz.question;
    var html = '';
    for (var i = 0; i < quiz.options.length; i += 1) {
      html += optionMarkup(quiz.options[i], i);
    }
    optionsEl.innerHTML = html;
    feedbackEl.hidden = true;
    feedbackEl.className = 'quiz__feedback';
    nextButton.hidden = true;
  }

  function handleOptionClick(quiz, event) {
    if (answered) {
      return;
    }
    var button = event.target.closest ? event.target.closest('[data-quiz-option]') : null;
    if (!button) {
      return;
    }
    answered = true;
    var chosenIndex = parseInt(button.getAttribute('data-quiz-option'), 10);
    var correct = chosenIndex === quiz.correctIndex;

    var buttons = optionsEl.querySelectorAll('[data-quiz-option]');
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].disabled = true;
      var optionIndex = parseInt(buttons[i].getAttribute('data-quiz-option'), 10);
      if (optionIndex === quiz.correctIndex) {
        buttons[i].classList.add('quiz__option--correct');
      } else if (optionIndex === chosenIndex) {
        buttons[i].classList.add('quiz__option--incorrect');
      }
    }

    feedbackEl.textContent = quiz.explanation;
    feedbackEl.className = 'quiz__feedback ' + (correct ? 'quiz__feedback--ok' : 'quiz__feedback--error');
    feedbackEl.hidden = false;
    nextButton.hidden = false;

    if (correct) {
      var state = window.NM.state.getState();
      window.NM.state.setState({ totalScore: state.totalScore + window.NM.config.SCORING.QUIZ_POINTS });
    }
  }

  function showQuizPanel(quiz) {
    answered = false;
    renderQuizQuestion(quiz);
    explanationPanel.hidden = true;
    quizPanel.hidden = false;
  }

  /**
   * Abre el modal de explicación + quiz para el nivel indicado (RF-50 a RF-53).
   * @param {number} levelId
   * @param {{onDone: function(): void}} options
   */
  function showLesson(levelId, options) {
    var law = window.NM.content.laws[levelId];
    var quiz = window.NM.content.quiz[levelId];

    renderExplanation(law);
    explanationPanel.hidden = false;
    quizPanel.hidden = true;
    pendingDone = options.onDone;

    continueButton.onclick = function () {
      showQuizPanel(quiz);
    };
    optionsEl.onclick = function (event) {
      handleOptionClick(quiz, event);
    };
    nextButton.onclick = function () {
      window.NM.screens.closeModal();
      if (pendingDone) {
        pendingDone();
      }
    };

    window.NM.screens.openModal('lesson');
  }

  function init() {
    queryDom();
  }

  window.NM = window.NM || {};
  window.NM.quiz = { init: init, showLesson: showLesson };
})();
