/**
 * CSInterface - v11.0.0
 * Adobe CEP CSInterface for communicate with Host Application
 */
function CSInterface() {}

/**
 * User interface class styles
 */
function UIColor(red, green, blue, alpha) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
}

function AppSkinInfo(baseFontFamily, baseFontSize, appBarBackgroundColor, panelBackgroundColor, appBarBackgroundColorSRGB, panelBackgroundColorSRGB, systemHighlightColor) {
    this.baseFontFamily = baseFontFamily;
    this.baseFontSize = baseFontSize;
    this.appBarBackgroundColor = appBarBackgroundColor;
    this.panelBackgroundColor = panelBackgroundColor;
    this.appBarBackgroundColorSRGB = appBarBackgroundColorSRGB;
    this.panelBackgroundColorSRGB = panelBackgroundColorSRGB;
    this.systemHighlightColor = systemHighlightColor;
}

function HostEnvironment(appId, appVersion, appName, appLocale, cyberAppInfo, sHostAppInfo, appSkinInfo) {
    this.appId = appId;
    this.appVersion = appVersion;
    this.appName = appName;
    this.appLocale = appLocale;
    this.appSkinInfo = appSkinInfo;
}

function CSEvent(type, scope, appId, extensionId) {
    this.type = type;
    this.scope = scope;
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = "";
}

CSInterface.prototype.getHostEnvironment = function() {
    if (window.__adobe_cep__) {
        var hostEnv = window.__adobe_cep__.getHostEnvironment();
        return JSON.parse(hostEnv);
    }
    return {
        appName: "PPRO",
        appVersion: "24.0",
        appLocale: "en_US",
        appSkinInfo: {
            panelBackgroundColor: { color: { red: 24, green: 24, blue: 24, alpha: 255 } }
        }
    };
};

CSInterface.prototype.closePlugin = function() {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.closePlugin();
    }
};

CSInterface.prototype.evalScript = function(script, callback) {
    if (window.__adobe_cep__) {
        if (callback === undefined || callback === null) {
            callback = function() {};
        }
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        // Fallback for browser dev mode
        console.warn("[CSInterface Mock] evalScript:", script);
        if (callback) callback('{"status":"mock_success","message":"Dev mode mock execute"}');
    }
};

CSInterface.prototype.addEventListener = function(type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    }
};

CSInterface.prototype.removeEventListener = function(type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    }
};

CSInterface.prototype.dispatchEvent = function(event) {
    if (window.__adobe_cep__) {
        if (typeof event === 'object') {
            event = JSON.stringify(event);
        }
        window.__adobe_cep__.dispatchEvent(event);
    }
};

CSInterface.prototype.getSystemPath = function(pathType) {
    if (window.__adobe_cep__) {
        var path = window.__adobe_cep__.getSystemPath(pathType);
        return path;
    }
    return "";
};

if (typeof module !== 'undefined') {
    module.exports = CSInterface;
}
