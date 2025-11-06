const CLOUD_ENV_ID = '';

App({
  onLaunch() {
    if (wx.cloud) {
      try {
        wx.cloud.init({ env: CLOUD_ENV_ID || undefined, traceUser: true });
        console.log('Cloud environment initialized');
      } catch (error) {
        console.warn('Cloud init failed', error);
      }
    } else {
      console.warn('Current base library does not support wx.cloud');
    }

    console.log('Gomoku Mini Program Launched');
  }
});