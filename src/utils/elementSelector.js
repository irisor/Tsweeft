export function createElementSelector({ onSelect = () => {}, exclude = null } = {}) {
	// Create highlight overlay
	const overlay = document.createElement('div');
	overlay.style.cssText = `
	  position: fixed;
	  pointer-events: none;
	  z-index: 10000;
	  border: 2px solid #007bff;
	  background-color: rgba(0, 123, 255, 0.1);
	  display: none;
	`;
	document.body.appendChild(overlay);
  
	// Create style for highlighted elements
	const highlightClass = 'element-selector-highlight';
	const style = document.createElement('style');
	style.textContent = `
	  .${highlightClass} {
		outline: 2px solid #007bff !important;
		outline-offset: -2px !important;
	  }
	`;
	document.head.appendChild(style);
  
	let currentElement = null;
  
	function handleMouseOver(event) {
	  const target = event.target;
	  
	  // Skip if element matches exclude selector
	  if (exclude && target.matches(exclude)) {
		return;
	  }
	  
	  // Remove highlight from previous element
	  if (currentElement && currentElement !== target) {
		currentElement.classList.remove(highlightClass);
	  }
	  
	  // Highlight current element
	  currentElement = target;
	  target.classList.add(highlightClass);
	  
	  // Update overlay position
	  const rect = target.getBoundingClientRect();
	  overlay.style.display = 'block';
	  overlay.style.top = rect.top + 'px';
	  overlay.style.left = rect.left + 'px';
	  overlay.style.width = rect.width + 'px';
	  overlay.style.height = rect.height + 'px';
	  
	  event.stopPropagation();
	}
	
	function handleMouseOut(event) {
	  const target = event.target;
	  target.classList.remove(highlightClass);
	  overlay.style.display = 'none';
	  event.stopPropagation();
	}
	
	function handleClick(event) {
	  event.preventDefault();
	  event.stopPropagation();
	  
	  const target = event.target;
	  
	  // Skip if element matches exclude selector
	  if (exclude && target.matches(exclude)) {
		return;
	  }
	  
	  cleanup();
	  onSelect(target);
	}
  
	// Start element selection mode
	document.body.style.cursor = 'pointer';
	document.addEventListener('mouseover', handleMouseOver, true);
	document.addEventListener('mouseout', handleMouseOut, true);
	document.addEventListener('click', handleClick, true);
  
	// Cleanup function
	function cleanup() {
	  document.body.style.cursor = '';
	  document.removeEventListener('mouseover', handleMouseOver, true);
	  document.removeEventListener('mouseout', handleMouseOut, true);
	  document.removeEventListener('click', handleClick, true);
	  
	  if (currentElement) {
		currentElement.classList.remove(highlightClass);
		currentElement = null;
	  }
	  
	  overlay.style.display = 'none';
	  overlay.remove();
	  style.remove();
	}
  
	// Return cleanup function
	return cleanup;
  }
  
  // Usage example:
  /*
  // Start element selection
  const cleanup = createElementSelector({
	onSelect: (element) => {
	  console.log('Selected element:', element);
	  // Do something with the selected element
	},
	exclude: '.no-select, .other-excluded-class' // Optional: CSS selector for elements to exclude
  });
  
  // To stop element selection before a choice is made:
  // cleanup();
  */
