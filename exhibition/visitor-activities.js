(() => {
  const {countries, visitorActivities} = EXHIBITION;
  const countryIds = Object.keys(countries);
  const passportKey = 'more-than-a-meal.passport.v1';
  const reflectionKey = 'more-than-a-meal.reflection.v1';

  function storage(key, fallback) {
    let value = fallback;
    let available = true;
    return {
      read() {
        if (available) {
          try {
            const raw = localStorage.getItem(key);
            value = raw === null ? fallback : JSON.parse(raw);
          } catch (error) {
            // Ignore malformed data and retain the in-memory value if storage is blocked.
            if (!(error instanceof SyntaxError)) available = false;
          }
        }
        return value;
      },
      write(next) {
        value = next;
        try {
          localStorage.setItem(key, JSON.stringify(next));
          available = true;
        } catch (_) {
          available = false;
        }
        return available;
      }
    };
  }

  function create({element, button, track, badge}) {
    const passport = storage(passportKey, []);
    const reflections = storage(reflectionKey, '');
    const stampSet = () => {
      const saved = passport.read();
      return new Set(countryIds.filter(id => Array.isArray(saved) && saved.includes(id)));
    };
    const updateBadge = (stamps = stampSet()) => {
      const next = stamps.size + '/' + countryIds.length;
      if (badge.textContent !== next) badge.textContent = next;
    };
    updateBadge();
    window.addEventListener('storage', event => {
      if (event.key === passportKey || event.key === null) updateBadge();
    });

    function stamp(countryId, islandId) {
      const stamps = stampSet();
      if (!countryIds.includes(countryId) || stamps.has(countryId)) return;
      stamps.add(countryId);
      passport.write([...stamps]);
      updateBadge(stamps);
      track('passport_stamp_collected', {country_id: countryId, island_id: islandId});
      if (stamps.size === countryIds.length) track('passport_completed');
    }

    function actions(parent) {
      return element('div', '', parent, 'activity-actions');
    }

    function status(parent, message = '') {
      const node = element('p', message, parent, 'activity-status');
      node.setAttribute('role', 'status');
      return node;
    }

    function renderPassport(parent, message = '') {
      parent.replaceChildren();
      const stamps = stampSet();
      element('p', 'Open a food display to collect a stamp for its country. Your passport is stored in this browser.', parent);
      element('p', stamps.size + '/' + countryIds.length + ' countries explored', parent, 'passport-progress');
      const slots = element('ul', '', parent, 'passport-slots');
      for (const id of countryIds) {
        const country = countries[id];
        const collected = stamps.has(id);
        const slot = element('li', '', slots, collected ? 'passport-slot collected' : 'passport-slot');
        slot.style.setProperty('--stamp-color', country.color);
        const mark = element('span', collected ? visitorActivities.stamps[id] : '◌', slot, 'stamp-symbol');
        mark.setAttribute('aria-hidden', 'true');
        element('strong', country.name, slot);
        element('span', collected ? 'Collected' : 'To explore', slot, 'stamp-state');
      }
      if (stamps.size === countryIds.length) {
        element('p', 'Congratulations! You’ve explored food stories from all six countries.', parent, 'activity-notice');
      }
      const controls = actions(parent);
      const feedback = status(parent, message);
      const reset = button('Reset passport', controls, () => {
        controls.replaceChildren();
        feedback.textContent = 'Clear all six stamp slots from this passport?';
        const cancel = button('Keep my stamps', controls, () => {
          renderPassport(parent);
          parent.querySelector('button').focus();
        });
        button('Clear stamps', controls, () => {
          const persisted = passport.write([]);
          updateBadge();
          renderPassport(parent, persisted ? 'Passport cleared.' : 'Passport cleared for this visit. Browser storage is unavailable.');
          parent.querySelector('.passport-progress').focus();
        });
        cancel.focus();
      });
      reset.disabled = stamps.size === 0;
      parent.querySelector('.passport-progress').tabIndex = -1;
    }

    function renderQuiz(parent) {
      const questions = visitorActivities.quiz;
      let index = 0;
      let score = 0;
      function showQuestion() {
        parent.replaceChildren();
        const question = questions[index];
        const heading = element('p', 'Question ' + (index + 1) + ' of ' + questions.length, parent, 'activity-step');
        heading.tabIndex = -1;
        heading.focus();
        element('h3', question.prompt, parent);
        const options = element('div', '', parent, 'quiz-options');
        const feedback = status(parent);
        let answered = false;
        question.options.forEach((option, choice) => {
          button(option, options, () => {
            if (answered) return;
            answered = true;
            const correct = choice === question.answer;
            if (correct) score++;
            for (const item of options.children) item.disabled = true;
            feedback.textContent = (correct ? 'Correct. ' : 'Not quite. ') + question.explanation;
            const last = index + 1 === questions.length;
            const next = button(last ? 'See my score' : 'Next question', parent, () => {
              index++;
              if (last) showScore();
              else showQuestion();
            });
            next.focus();
          }, 'quiz-option');
        });
      }

      function showScore() {
        track('quiz_completed');
        parent.replaceChildren();
        const result = element('h3', 'You scored ' + score + '/' + questions.length, parent);
        result.tabIndex = -1;
        result.focus();
        element('p', 'Thanks for exploring the stories behind these dishes. You can revisit the islands or try another round.', parent);
        button('Retry quiz', parent, start);
      }

      function start() {
        index = 0;
        score = 0;
        track('quiz_started');
        showQuestion();
      }
      element('p', 'Five questions about the dishes and stories in this exhibition.', parent);
      button('Start quiz', parent, start);
    }

    function renderReflection(parent) {
      element('p', 'If one dish could remind you of home, what would it be, and why?', parent);
      element('p', 'Your reflection is saved only in this browser on your device. It is not publicly shared. Please leave out names and personal details.', parent);
      const label = element('label', 'Your reflection', parent);
      label.htmlFor = 'reflection-text';
      const input = element('textarea', '', parent, 'reflection-text');
      input.id = label.htmlFor;
      input.maxLength = 300;
      input.rows = 4;
      input.setAttribute('aria-describedby', 'reflection-count');
      const counter = element('p', '', parent, 'activity-step');
      counter.id = 'reflection-count';
      const controls = actions(parent);
      const feedback = status(parent);
      const stored = reflections.read();
      let lastSaved = typeof stored === 'string' ? stored.slice(0, 300) : '';
      input.value = lastSaved;
      const update = () => {
        counter.textContent = input.value.length + '/300 characters';
        save.disabled = !input.value.trim() || input.value.trim() === lastSaved;
        remove.disabled = !lastSaved && !input.value;
      };
      const save = button('Save reflection', controls, () => {
        lastSaved = input.value.trim().slice(0, 300);
        if (!lastSaved) return;
        input.value = lastSaved;
        const persisted = reflections.write(lastSaved);
        feedback.textContent = persisted ? 'Reflection saved on this device.' : 'Saved for this visit only. Browser storage is unavailable.';
        if (persisted) track('reflection_saved');
        update();
      });
      const remove = button('Delete reflection', controls, () => {
        const persisted = reflections.write('');
        lastSaved = '';
        input.value = '';
        feedback.textContent = persisted ? 'Reflection deleted.' : 'Reflection cleared for this visit. Browser storage is unavailable.';
        update();
        input.focus();
      });
      input.addEventListener('input', update);
      update();
    }

    return {stamp, renderPassport, renderQuiz, renderReflection};
  }

  window.ExhibitionActivities = {create};
})();
