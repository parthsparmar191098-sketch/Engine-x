const $ = (selector) => document.querySelector(selector);
const categoryGrid = $('#categoryGrid');
const itemGrid = $('#itemGrid');

function cardTemplate(item, isCategory=false){
  return `<article class="card">
    <div class="card-icon">${item.icon}</div>
    <h3>${item.name}</h3>
    <p>${item.description}</p>
    <a class="card-link" href="${item.link}">${isCategory ? 'Explore category →' : 'View details →'}</a>
  </article>`;
}
function renderCategories(){categoryGrid.innerHTML = ENGINE_CATEGORIES.map(c=>cardTemplate(c,true)).join('');}
function renderItems(query=''){
  const filtered = ENGINE_ITEMS.filter(item => `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  itemGrid.innerHTML = filtered.length ? filtered.map(item=>cardTemplate(item)).join('') : '<p>No matching items found.</p>';
}
$('#searchInput')?.addEventListener('input', e=>renderItems(e.target.value));
$('#menuToggle')?.addEventListener('click',()=>$('#mainNav').classList.toggle('open'));
$('#year').textContent = new Date().getFullYear();
renderCategories(); renderItems();
