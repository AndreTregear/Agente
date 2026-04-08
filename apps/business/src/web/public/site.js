/* ═══════════════════════════════════════════════════════════════════════════════
   Agente.ceo — Landing Page JavaScript
   ═══════════════════════════════════════════════════════════════════════════════ */

// DOM Elements
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

// Navigation scroll effect
function handleScroll() {
  const scrolled = window.scrollY > 20;
  nav.classList.toggle('scrolled', scrolled);
}

// Mobile navigation toggle
function toggleMobileNav() {
  navToggle.classList.toggle('active');
  navLinks.classList.toggle('open');
  document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
}

// Smooth scroll to anchor links
function smoothScrollToAnchor(e) {
  const href = e.target.getAttribute('href');
  if (href && href.startsWith('#')) {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const offsetTop = target.offsetTop - 80; // Account for fixed nav
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
      
      // Close mobile nav if open
      if (navLinks.classList.contains('open')) {
        toggleMobileNav();
      }
    }
  }
}

// Intersection Observer for fade-in animations
function initFadeInAnimations() {
  const fadeElements = document.querySelectorAll('.fade-in');
  
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, parseInt(delay));
        fadeObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  fadeElements.forEach(el => {
    fadeObserver.observe(el);
  });
}

// Terminal typing animation
function initTerminalAnimation() {
  const terminalLines = document.querySelectorAll('.t-line');
  const cursor = document.querySelector('.t-cursor');
  
  if (!terminalLines.length || !cursor) return;
  
  let currentLine = 0;
  let currentChar = 0;
  let isDeleting = false;
  
  function typeText() {
    if (currentLine >= terminalLines.length) {
      // Animation complete, restart after delay
      setTimeout(() => {
        terminalLines.forEach(line => {
          const textElement = line.querySelector('.t-text');
          if (textElement) {
            textElement.style.width = '0';
            textElement.style.overflow = 'hidden';
          }
        });
        currentLine = 0;
        currentChar = 0;
        typeText();
      }, 3000);
      return;
    }
    
    const line = terminalLines[currentLine];
    const textElement = line.querySelector('.t-text');
    
    if (!textElement) {
      currentLine++;
      setTimeout(typeText, 100);
      return;
    }
    
    const fullText = textElement.textContent;
    
    if (!isDeleting && currentChar <= fullText.length) {
      textElement.style.width = 'auto';
      textElement.style.overflow = 'visible';
      currentChar = fullText.length;
      currentLine++;
      setTimeout(typeText, 1000);
    }
  }
  
  // Start typing animation when terminal is visible
  const terminalObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          typeText();
        }, 1000);
        terminalObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  
  const terminal = document.querySelector('.terminal');
  if (terminal) {
    terminalObserver.observe(terminal);
  }
}

// Parallax effect for hero section
function initParallaxEffect() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  
  function updateParallax() {
    const scrolled = window.pageYOffset;
    const speed = 0.5;
    hero.style.transform = `translateY(${scrolled * speed}px)`;
  }
  
  window.addEventListener('scroll', updateParallax, { passive: true });
}

// Hover effects for interactive elements
function initHoverEffects() {
  // Feature cards tilt effect
  const featureCards = document.querySelectorAll('.feature-card');
  
  featureCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-8px) rotateX(5deg)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(-4px) rotateX(0deg)';
    });
    
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateX = (e.clientY - centerY) / 10;
      const rotateY = (centerX - e.clientX) / 10;
      
      card.style.transform = `translateY(-8px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
  });
  
  // Pricing cards glow effect
  const pricingCards = document.querySelectorAll('.pricing-card');
  
  pricingCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 20px 40px rgba(139, 92, 246, 0.3)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
    });
  });
}

// Gradient animation for hero text
function initGradientAnimation() {
  const gradientElements = document.querySelectorAll('.text-gradient');
  
  gradientElements.forEach(element => {
    const colors = ['#8B5CF6', '#06B6D4', '#10B981'];
    let colorIndex = 0;
    
    setInterval(() => {
      const nextColor = colors[(colorIndex + 1) % colors.length];
      const currentColor = colors[colorIndex];
      element.style.backgroundImage = `linear-gradient(135deg, ${currentColor} 0%, ${nextColor} 100%)`;
      colorIndex = (colorIndex + 1) % colors.length;
    }, 3000);
  });
}

// Initialize cursor following effect
function initCursorEffect() {
  const cursor = document.createElement('div');
  cursor.classList.add('custom-cursor');
  cursor.style.cssText = `
    position: fixed;
    width: 20px;
    height: 20px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.8) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    mix-blend-mode: difference;
    transition: transform 0.1s ease;
    display: none;
  `;
  document.body.appendChild(cursor);
  
  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.display = 'block';
  });
  
  function animateCursor() {
    const dx = mouseX - cursorX;
    const dy = mouseY - cursorY;
    
    cursorX += dx * 0.1;
    cursorY += dy * 0.1;
    
    cursor.style.left = cursorX - 10 + 'px';
    cursor.style.top = cursorY - 10 + 'px';
    
    requestAnimationFrame(animateCursor);
  }
  
  animateCursor();
  
  // Hide cursor when leaving window
  document.addEventListener('mouseleave', () => {
    cursor.style.display = 'none';
  });
}

// Performance monitoring
function logPerformance() {
  if (window.performance) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = window.performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`🚀 Agente.ceo loaded in ${loadTime}ms`);
      }, 0);
    });
  }
}

// Easter egg - Konami code
function initEasterEgg() {
  const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
  let userInput = [];
  
  document.addEventListener('keydown', (e) => {
    userInput.push(e.keyCode);
    
    if (userInput.length > konamiCode.length) {
      userInput.shift();
    }
    
    if (userInput.length === konamiCode.length) {
      if (userInput.every((key, index) => key === konamiCode[index])) {
        // Easter egg activated!
        document.body.style.animation = 'rainbow 2s infinite';
        
        const style = document.createElement('style');
        style.textContent = `
          @keyframes rainbow {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
          document.body.style.animation = '';
          document.head.removeChild(style);
        }, 10000);
        
        userInput = [];
      }
    }
  });
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Core functionality
  handleScroll();
  initFadeInAnimations();
  initTerminalAnimation();
  
  // Enhanced effects
  initParallaxEffect();
  initHoverEffects();
  initGradientAnimation();
  initCursorEffect();
  
  // Development helpers
  logPerformance();
  initEasterEgg();
  
  // Event listeners
  window.addEventListener('scroll', handleScroll, { passive: true });
  navToggle.addEventListener('click', toggleMobileNav);
  
  // Smooth scroll for anchor links
  document.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      smoothScrollToAnchor(e);
    }
  });
  
  // Close mobile nav when clicking outside
  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('open') && 
        !navLinks.contains(e.target) && 
        !navToggle.contains(e.target)) {
      toggleMobileNav();
    }
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) {
      toggleMobileNav();
    }
  });
});

// Initialize when page is fully loaded
window.addEventListener('load', () => {
  // Remove loading class if it exists
  document.body.classList.remove('loading');
  
  // Log successful initialization
  console.log('🎉 Agente.ceo frontend initialized successfully!');
});

// Handle visibility changes for performance
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause animations when tab is not visible
    document.body.classList.add('page-hidden');
  } else {
    // Resume animations when tab becomes visible
    document.body.classList.remove('page-hidden');
  }
});

// Export for use in other scripts
window.AgenteApp = {
  nav: {
    toggle: toggleMobileNav,
    scroll: handleScroll
  },
  animations: {
    fadeIn: initFadeInAnimations,
    terminal: initTerminalAnimation,
    parallax: initParallaxEffect
  },
  effects: {
    hover: initHoverEffects,
    gradient: initGradientAnimation,
    cursor: initCursorEffect
  }
};