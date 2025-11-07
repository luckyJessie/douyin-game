const { DIFFICULTY_SETTINGS } = require('../../utils/settings');

Page({
  data: {
    selectedMode: 'local',
    difficultyOptions: DIFFICULTY_SETTINGS.map(item => item.label),
    difficultyIndex: 1,
    playerFirst: 'player',
    loading: false
  },

  onShow() {
    this.setData({ loading: false });
  },

  handleModeChange(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!mode || this.data.selectedMode === mode) {
      return;
    }
    this.setData({ selectedMode: mode });
  },

  handleDifficultyChange(event) {
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && index >= 0 && index < this.data.difficultyOptions.length) {
      this.setData({ difficultyIndex: index });
    }
  },

  handleFirstMoveChange(event) {
    const value = event.detail.value || 'player';
    this.setData({ playerFirst: value });
  },

  startGame() {
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });

    if (this.data.selectedMode === 'local') {
      const url = `/pages/game/game?mode=local&difficulty=${this.data.difficultyIndex}&first=${this.data.playerFirst}`;
      wx.navigateTo({
        url,
        complete: () => {
          this.setData({ loading: false });
        }
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/game/game?mode=online',
      complete: () => {
        this.setData({ loading: false });
      }
    });
  }
});
