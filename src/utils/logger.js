const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

class Logger {
    static level = LogLevel.WARN;

    static setLevel(level) {
        if (Object.values(LogLevel).includes(level)) {
            this.level = level;
        }
    }

    static formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}]`;
        
        if (args.length > 0) {
            return [`${prefix} ${message}`, ...args];
        }
        return `${prefix} ${message}`;
    }

    static debug(message, ...args) {
        if (this.level === LogLevel.DEBUG) {
            console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
        }
    }

    static info(message, ...args) {
        if ([LogLevel.DEBUG, LogLevel.INFO].includes(this.level)) {
            console.info(this.formatMessage(LogLevel.INFO, message), ...args);
        }
    }

    static warn(message, ...args) {
        if ([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN].includes(this.level)) {
            console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
        }
    }

    static error(message, ...args) {
        console.error(this.formatMessage(LogLevel.ERROR, message), ...args);
    }
}

export { Logger, LogLevel };
