export function debounce(func, time) {
	let timeoutId;
	return (...args) => {
	  clearTimeout(timeoutId);
	  timeoutId = setTimeout(() => {
		func(...args);
		timeoutId = null;
	  }, time);
	};
  }