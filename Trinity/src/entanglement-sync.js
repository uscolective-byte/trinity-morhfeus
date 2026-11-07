/**
 * @module TRINITY_OMNI_CORE
 * @subsystem ENTANGLEMENT_SYNC
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul entanglement-sync.js (Trinity/src/entanglement-sync.js).
 * Zabezpečuje stavové zrkadlenie bez pollingu (Event-driven / SSE / Webhook).
 */

import { EventEmitter } from 'node:events';

export class EntanglementBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessionId = options.sessionId || 'omniverse-session';
    this.peers = new Set();
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
  }

  /**
   * Publikuje stavovú zmenu (Entanglement State Change).
   * @param {string} eventName - Názov udalosti (napr. 'state-change', 'intent-collapse')
   * @param {object} payload - Údaje o stave
   */
  emitStateChange(eventName, payload = {}) {
    const event = {
      channel: eventName,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      status: payload.status || 'SYNCED',
      data: payload
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Lokálna okamžitá odozva (EventBus)
    this.emit(eventName, event);
    this.emit('*', event);

    return event;
  }

  /**
   * Zaregistruje SSE / Webhook odberateľa pre streamovanie v reálnom čase.
   * @param {Function} peerWriter - Funkcia odosielajúca dáta klientovi (napr. SSE stream controller)
   */
  registerPeer(peerWriter) {
    this.peers.add(peerWriter);
    return () => {
      this.peers.delete(peerWriter);
    };
  }

  /**
   * Rozošle udalosť všetkým pripojeným peerom (Edge Worker -> Local Bridge).
   * @param {object} event
   */
  broadcastToPeers(event) {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    for (const peer of this.peers) {
      try {
        peer(message);
      } catch (err) {
        this.peers.delete(peer);
      }
    }
  }
}

// Globálna inštancia pre Trinity prostredie
export const globalEntanglementBridge = new EntanglementBridge();
