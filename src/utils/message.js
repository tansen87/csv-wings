export function message(message, options) {
    const { type = 'info', duration = 3000 } = options || {};
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg z-50 ${getTypeClass(type)}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, duration);
}
function getTypeClass(type) {
    switch (type) {
        case 'success':
            return 'bg-green-500 text-white';
        case 'warning':
            return 'bg-yellow-500 text-white';
        case 'error':
            return 'bg-red-500 text-white';
        default:
            return 'bg-blue-500 text-white';
    }
}
//# sourceMappingURL=message.js.map