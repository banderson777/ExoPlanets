'use strict';
const bin = document.getElementById('bin');
const points = document.querySelectorAll('[data-bin]');
function highlight() {
  for (const point of points) {
    const selected = Number(point.dataset.bin) === bin.selectedIndex;
    point.querySelector('circle').setAttribute('fill', selected ? '#ffc478' : '#bca5ff');
    point.querySelector('circle').setAttribute('r', selected ? '6' : '4');
  }
}
for (const point of points) {
  point.addEventListener('click', () => {
    bin.selectedIndex = Number(point.dataset.bin);
    highlight();
    bin.focus({preventScroll:true});
  });
}
bin.addEventListener('change', highlight);
highlight();
