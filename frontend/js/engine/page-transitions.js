function transitionToPage(container, renderFn, param) {
  if (!container) {
    console.warn('transitionToPage: no container');
    return;
  }

  container.style.display = '';
  container.innerHTML = '';

  try {
    renderFn(param, container);
  } catch (e) {
    console.error('transitionToPage: render error', e);
    container.innerHTML = '<div class="noviq-page-hero"><h1>' + t('Something went wrong') + '</h1><p>' + t('Please try again.') + '</p></div>';
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  container.style.opacity = '0';
  container.style.transform = 'translateY(12px)';
  container.style.transition = 'none';

  requestAnimationFrame(() => {
    container.style.transition = 'opacity 0.25s ease, transform 0.3s ease';
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  });

  try {
    container.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
      if (typeof observeReveal === 'function') observeReveal(el);
    });
  } catch (e) {}
}

function navigateTo(path, data) {
  AppRouter.go(path, data);
}
