export function handleUserMessage(message, type) {
	const toastContainer = document.getElementById('toast-container');
	if (!toastContainer) {
	  const container = document.createElement('div');
	  container.id = 'toast-container';
	  container.className = 'toast-container';
	  document.body.appendChild(container);
	}
  
	const toastElement = document.createElement('div');
	toastElement.className = `toast ${type}`;
	toastElement.textContent = message;
  
	const container = document.getElementById('toast-container');
	container.appendChild(toastElement);
  
	setTimeout(() => {
	  container.removeChild(toastElement);
	}, 3000); // display message for 3 seconds
  }