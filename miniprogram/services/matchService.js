const { CLOUD_COLLECTION } = require('../core/constants');
const { createBoard } = require('../core/board');

class MatchService {
  constructor(db, envId) {
    this.db = db;
    this.envId = envId;
    this.roomWatcher = null;
    this.docId = null;
  }

  async createRoom(code, playerRole) {
    const board = createBoard();
    const data = {
      code,
      board,
      moves: [],
      turn: playerRole === 'black' ? 'black' : 'white',
      players: {
        black: playerRole === 'black' ? { ready: true } : null,
        white: playerRole === 'white' ? { ready: true } : null
      },
      lastMove: null,
      winner: null,
      updatedAt: Date.now()
    };
    const res = await this.db.collection(CLOUD_COLLECTION).add({ data });
    this.docId = res._id;
    return { id: res._id, board, code };
  }

  async joinRoom(code, role) {
    const res = await this.db.collection(CLOUD_COLLECTION).where({ code }).get();
    if (!res.data || res.data.length === 0) {
      return null;
    }
    const doc = res.data[0];
    this.docId = doc._id;
    const playerPath = role === 'black' ? 'players.black' : 'players.white';
    await this.db.collection(CLOUD_COLLECTION).doc(doc._id).update({
      data: {
        [playerPath]: { ready: true },
        updatedAt: Date.now()
      }
    });
    return doc;
  }

  async leaveRoom(role) {
    if (!this.docId) return;
    const updates = { updatedAt: Date.now() };
    if (role === 'black') {
      updates.status = 'closed';
    } else {
      updates['players.white'] = null;
    }
    await this.db.collection(CLOUD_COLLECTION).doc(this.docId).update({ data: updates }).catch(() => {});
    this.stopWatch();
  }

  watchRoom(docId, handlers) {
    this.stopWatch();
    this.roomWatcher = this.db.collection(CLOUD_COLLECTION).doc(docId).watch({
      onChange: snapshot => {
        if (!snapshot || !snapshot.docs || snapshot.docs.length === 0) {
          return;
        }
        handlers.onChange?.(snapshot.docs[0]);
      },
      onError: error => {
        console.error('Room watch error', error);
        handlers.onError?.(error);
      }
    });
  }

  stopWatch() {
    if (this.roomWatcher && typeof this.roomWatcher.close === 'function') {
      this.roomWatcher.close();
    }
    this.roomWatcher = null;
  }

  async pushMove({ row, col, role, player, board, winner }) {
    if (!this.docId) return;
    const command = this.db.command;
    await this.db.collection(CLOUD_COLLECTION).doc(this.docId).update({
      data: {
        board,
        lastMove: { row, col, role, player, timestamp: Date.now() },
        moves: command.push({ row, col, role, player, timestamp: Date.now() }),
        turn: winner ? null : role === 'black' ? 'white' : 'black',
        updatedAt: Date.now(),
        ...(winner ? { winner } : {})
      }
    });
  }
}

module.exports = {
  MatchService
};
