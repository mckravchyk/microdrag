export function createLogger(): void {
  const originalConsoleLog = window.console.log;

  const $logger = document.getElementById('Logger')!;
  const $toggle = document.getElementById('Logger-toggle')!;
  const $clear = document.getElementById('Logger-clear')!;
  const $messages = document.getElementById('Logger-messages')!;

  $toggle.addEventListener('click', () => {
    if (!$logger.classList.contains('collapsed')) {
      $logger.classList.add('collapsed');
    }
    else {
      $logger.classList.remove('collapsed');
    }
  });

  $clear.addEventListener('click', () => {
    $messages.innerHTML = '';
  });

  window.console.log = (message: string) => {
    originalConsoleLog(message);

    const $msg = document.createElement('DIV');
    $msg.classList.add('logger-message');
    $msg.textContent = message;
    $messages!.appendChild($msg);
    $messages!.scrollTo(0, $messages!.scrollHeight);
  };
}
