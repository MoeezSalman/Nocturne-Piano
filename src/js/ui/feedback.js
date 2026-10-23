import { h } from '../util.js';

export function toast(message, { error = false, action = null, ms = 2600 } = {}) {
  const host = document.getElementById('toasts');
  const el = h(`div.toast${error ? '.err' : ''}`, {}, h('span', {}, message));
  if (action) {
    el.append(
      h('button.btn.small', {
        onclick: () => {
          action.run();
          el.remove();
        },
      }, action.label),
    );
  }
  host.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, action ? ms + 2500 : ms);
}

/** Confirm dialog. `message` may contain **bold** text. Resolves true/false. */
export function confirmDialog(message, { ok = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    const host = document.getElementById('modal-host');
    const close = (v) => {
      host.textContent = '';
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(false);
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        close(true);
      }
    };
    const p = h('p');
    message.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (part.startsWith('**')) p.append(h('b', {}, part.slice(2, -2)));
      else p.append(part);
    });
    const okBtn = h(`button.btn${danger ? '.danger' : '.primary'}`, { onclick: () => close(true) }, ok);
    host.append(
      h('div.modal', {}, p, h('div.actions', {}, h('button.btn.ghost', { onclick: () => close(false) }, 'Cancel'), okBtn)),
    );
    host.onclick = (e) => e.target === host && close(false);
    document.addEventListener('keydown', onKey, true);
    okBtn.focus();
  });
}

/** Generic modal with arbitrary content; resolves when closed. */
export function showModal(content, { wide = false } = {}) {
  return new Promise((resolve) => {
    const host = document.getElementById('modal-host');
    const close = () => {
      host.textContent = '';
      document.removeEventListener('keydown', onKey, true);
      resolve();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const box = h('div.modal', { style: wide ? { width: 'min(860px, 94vw)', maxHeight: '86vh', overflow: 'auto' } : {} }, content);
    host.append(box);
    host.onclick = (e) => e.target === host && close();
    document.addEventListener('keydown', onKey, true);
    content.querySelector?.('[data-close]')?.addEventListener('click', close);
  });
}
