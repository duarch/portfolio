// Menu Hamburger para 2021
document.addEventListener('DOMContentLoaded', function() {
  const navList = document.getElementById('nav-list');
  let hamburgerElement = null;
  
  // Criar botão hamburger se em mobile
  if (window.innerWidth <= 768) {
    createHamburger();
  }

  // Recriar ao redimensionar
  window.addEventListener('resize', function() {
    const existingHamburger = navList.querySelector('.hamburger');
    if (window.innerWidth <= 768 && !existingHamburger) {
      createHamburger();
    } else if (window.innerWidth > 768 && existingHamburger) {
      existingHamburger.remove();
      navList.classList.remove('active');
      hamburgerElement = null;
    }
  });

  function createHamburger() {
    const hamburger = document.createElement('li');
    hamburger.className = 'hamburger';
    hamburger.innerHTML = '☰';
    hamburger.style.cursor = 'pointer';
    hamburger.style.padding = '14px 16px';
    hamburger.style.color = 'white';
    hamburger.style.fontSize = '1.5em';
    
    hamburgerElement = hamburger;
    
    hamburger.addEventListener('click', function() {
      navList.classList.toggle('active');
      // Mudar ícone de ☰ para X e vice-versa
      hamburger.innerHTML = navList.classList.contains('active') ? '✕' : '☰';
    });

    // Inserir no final da lista (após o back-arrow)
    navList.insertBefore(hamburger, navList.querySelector('#nav-links'));
  }
});
