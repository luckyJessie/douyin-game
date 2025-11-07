const CLOUD_ENV_ID = '';

App({
  onLaunch() {
    if (wx.cloud && CLOUD_ENV_ID) {
      try {
        wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
        console.log('Cloud environment initialized');
      } catch (error) {
        console.warn('Cloud init failed', error);
      }
    } else {
      if (!wx.cloud) {
        console.warn('Current base library does not support wx.cloud');
      } else {
        console.warn('CLOUD_ENV_ID not set, cloud features disabled');
      }
    }

    console.log('Gomoku Mini Program Launched');
  }
});