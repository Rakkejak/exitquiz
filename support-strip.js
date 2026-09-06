(() => {
  const modal = document.querySelector('.modal');
  if (!modal || document.getElementById('supportStrip')) return;

  const style = document.createElement('style');
  style.textContent = `
    .supportStrip{
      width:100%;
      margin-top:16px;
      border:0;
      border-radius:14px;
      padding:14px 18px;
      background:#1f9d5a;
      color:#fff;
      font:inherit;
      font-weight:900;
      letter-spacing:.005em;
      text-align:center;
      cursor:pointer;
      box-shadow:0 3px 0 rgba(0,0,0,.12);
      transition:transform .08s ease,background .15s ease;
    }
    .supportStrip:hover{background:#18864c}
    .supportStrip:active{transform:translateY(1px);box-shadow:0 2px 0 rgba(0,0,0,.10)}
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'supportStrip';
  button.className = 'supportStrip';
  button.textContent = 'content? geef ons 0,51 € voor de moeite.';
  button.addEventListener('click', () => {
    window.open('https://buy.stripe.com/14A8wPfdjecZgHW1cRgA802', '_blank', 'noopener,noreferrer');
  });
  modal.appendChild(button);
})();
