(function () {
  var ns = $.namespace('pskl.controller.piskel');

  ns.PiskelController = function (piskel) {
    if (piskel) {
      this.defaultPiskel = piskel.clone();
      this.piskels = []; //index; piskel
    } else {
      throw 'A piskel instance is mandatory for instanciating PiskelController';
    }
  };

  /**
   * Set the current piskel. Will reset the selected frame and layer unless specified
   * @param {Object} piskel
   * @param {Object} options:
   *                 preserveState {Boolean} if true, keep the selected frame and layer
   *                 noSnapshot {Boolean} if true, do not save a snapshot in the piskel
   *                            history for this call to setPiskel
   */

  ns.PiskelController.prototype.newPiskel = function () {
    const index = this._uuidv4();
    const piskel = this.defaultPiskel.clone();

    this.piskels.push({
      index: index,
      piskel: piskel
    });

    this.currentLayerIndex = 0;
    this.currentFrameIndex = 0;
    this.layerIdCounter = 1;

    return index;
  };

  ns.PiskelController.prototype.setPiskel = function (piskel, options) {
    this._setPiskel(this.selectedPiskel, piskel);
    options = options || {};
    if (!options.preserveState) {
      this.currentLayerIndex = 0;
      this.currentFrameIndex = 0;
    }

    this.layerIdCounter = 1;
  };

  ns.PiskelController.prototype.selectPiskel = function(index) {
    this.selectedPiskel = index;
  };

  ns.PiskelController.prototype.init = function () {
  };

  ns.PiskelController.prototype.getHeight = function () {
    return this._getPiskel(this.selectedPiskel).getHeight();
  };

  ns.PiskelController.prototype.getWidth = function () {
    return this._getPiskel(this.selectedPiskel).getWidth();
  };

  ns.PiskelController.prototype.getFPS = function () {
    return this._getPiskel(this.selectedPiskel).fps;
  };

  ns.PiskelController.prototype.setFPS = function (fps) {
    if (typeof fps !== 'number') {
      return;
    }
    this._getPiskel(this.selectedPiskel).fps = fps;
    $.publish(Events.FPS_CHANGED);
  };

  ns.PiskelController.prototype.getLayers = function () {
    return this._getPiskel(this.selectedPiskel).getLayers();
  };

  ns.PiskelController.prototype.getCurrentLayer = function () {
    return this.getLayerAt(this.currentLayerIndex);
  };

  ns.PiskelController.prototype.getLayerAt = function (index) {
    return this._getPiskel(this.selectedPiskel).getLayerAt(index);
  };

  ns.PiskelController.prototype.hasLayerAt = function (index) {
    return !!this.getLayerAt(index);
  };

  // FIXME ?? No added value compared to getLayerAt ??
  // Except normalizing to null if undefined ?? ==> To merge
  ns.PiskelController.prototype.getLayerByIndex = function (index) {
    var layers = this.getLayers();
    if (layers[index]) {
      return layers[index];
    } else {
      return null;
    }
  };

  ns.PiskelController.prototype.getCurrentFrame = function () {
    var layer = this.getCurrentLayer();
    return layer.getFrameAt(this.currentFrameIndex);
  };

  ns.PiskelController.prototype.getCurrentLayerIndex = function () {
    return this.currentLayerIndex;
  };

  ns.PiskelController.prototype.getCurrentFrameIndex = function () {
    return this.currentFrameIndex;
  };

  ns.PiskelController.prototype.getPiskel = function () {
    return this._getPiskel(this.selectedPiskel);
  };

  ns.PiskelController.prototype.getPiskelData = function () {
    return this._getPiskelData(this.selectedPiskel);
  };

  ns.PiskelController.prototype.isTransparent = function () {
    return this.getLayers().some(function (l) {
      return l.isTransparent();
    });
  };

  ns.PiskelController.prototype.renderFrameAt = function (index, preserveOpacity) {
    return pskl.utils.LayerUtils.flattenFrameAt(this.getLayers(), index, preserveOpacity);
  };

  ns.PiskelController.prototype.hasFrameAt = function (index) {
    return !!this.getCurrentLayer().getFrameAt(index);
  };

  ns.PiskelController.prototype.addFrame = function () {
    this.addFrameAt(this.getFrameCount());
  };

  ns.PiskelController.prototype.addFrameAtCurrentIndex = function () {
    this.addFrameAt(this.currentFrameIndex + 1);
  };

  ns.PiskelController.prototype.addFrameAt = function (index) {
    this.getLayers().forEach(function (l) {
      l.addFrameAt(this.createEmptyFrame_(), index);
    }.bind(this));

    this.onFrameAddedAt_(index);
  };

  ns.PiskelController.prototype.onFrameAddedAt_ = function (index) {
    this._getPiskel(this.selectedPiskel).hiddenFrames =
    this._getPiskel(this.selectedPiskel).hiddenFrames.map(function (hiddenIndex) {
      if (hiddenIndex >= index) {
        return hiddenIndex + 1;
      }
      return hiddenIndex;
    });

    this.setCurrentFrameIndex(index);
  };

  ns.PiskelController.prototype.createEmptyFrame_ = function () {
    var w = this._getPiskel(this.selectedPiskel).getWidth();
    var h = this._getPiskel(this.selectedPiskel).getHeight();
    return new pskl.model.Frame(w, h);
  };

  ns.PiskelController.prototype.removeFrameAt = function (index) {
    this.getLayers().forEach(function (l) {
      l.removeFrameAt(index);
    });

    // Update the array of hidden frames since some hidden indexes might have shifted.
    this._getPiskel(this.selectedPiskel).hiddenFrames =
    this._getPiskel(this.selectedPiskel).hiddenFrames.map(function (hiddenIndex) {
      if (hiddenIndex > index) {
        return hiddenIndex - 1;
      }
      return hiddenIndex;
    });

    // Current frame index is impacted if the removed frame was before the current frame
    if (this.currentFrameIndex >= index && this.currentFrameIndex > 0) {
      this.setCurrentFrameIndex(this.currentFrameIndex - 1);
    }
  };

  ns.PiskelController.prototype.duplicateCurrentFrame = function () {
    this.duplicateFrameAt(this.currentFrameIndex);
  };

  ns.PiskelController.prototype.duplicateFrameAt = function (index) {
    this.getLayers().forEach(function (l) {
      l.duplicateFrameAt(index);
    });
    this.onFrameAddedAt_(index + 1);
  };

  /**
   * Toggle frame visibility for the frame at the provided index.
   * A visible frame will be included in the animated preview.
   */
  ns.PiskelController.prototype.toggleFrameVisibilityAt = function (index) {
    var hiddenFrames = this._getPiskel(this.selectedPiskel).hiddenFrames;
    if (hiddenFrames.indexOf(index) === -1) {
      hiddenFrames.push(index);
    } else {
      hiddenFrames = hiddenFrames.filter(function (i) {
        return i !== index;
      });
    }

    // Keep the hiddenFrames array sorted.
    this._getPiskel(this.selectedPiskel).hiddenFrames = hiddenFrames.sort();
  };

  ns.PiskelController.prototype.moveFrame = function (fromIndex, toIndex) {
    this.getLayers().forEach(function (l) {
      l.moveFrame(fromIndex, toIndex);
    });

    // Update the array of hidden frames since some hidden indexes might have shifted.
    this._getPiskel(this.selectedPiskel).hiddenFrames =
    this._getPiskel(this.selectedPiskel).hiddenFrames.map(function (index) {
      if (index === fromIndex) {
        return toIndex;
      }

      // All the frames between fromIndex and toIndex changed their index.
      var isImpacted = index >= Math.min(fromIndex, toIndex) &&
                       index <= Math.max(fromIndex, toIndex);
      if (isImpacted) {
        if (fromIndex < toIndex) {
          // If the frame moved to a higher index, all impacted frames had their index
          // reduced by 1.
          return index - 1;
        } else {
          // Otherwise, they had their index increased by 1.
          return index + 1;
        }
      }
    });
  };

  ns.PiskelController.prototype.hasVisibleFrameAt = function (index) {
    return this._getPiskel(this.selectedPiskel).hiddenFrames.indexOf(index) === -1;
  };

  ns.PiskelController.prototype.getVisibleFrameIndexes = function () {
    return this.getCurrentLayer().getFrames().map(function (frame, index) {
      return index;
    }).filter(function (index) {
      return this._getPiskel(this.selectedPiskel).hiddenFrames.indexOf(index) === -1;
    }.bind(this));
  };

  ns.PiskelController.prototype.getFrameCount = function () {
    return this._getPiskel(this.selectedPiskel).getFrameCount();
  };

  ns.PiskelController.prototype.setCurrentFrameIndex = function (index) {
    if (this.hasFrameAt(index)) {
      this.currentFrameIndex = index;
    } else {
      window.console.error('Could not set current frame index to ' + index);
    }
  };

  ns.PiskelController.prototype.selectNextFrame = function () {
    var nextIndex = this.currentFrameIndex + 1;
    if (nextIndex < this.getFrameCount()) {
      this.setCurrentFrameIndex(nextIndex);
    }
  };

  ns.PiskelController.prototype.selectPreviousFrame = function () {
    var nextIndex = this.currentFrameIndex - 1;
    if (nextIndex >= 0) {
      this.setCurrentFrameIndex(nextIndex);
    }
  };

  ns.PiskelController.prototype.setCurrentLayerIndex = function (index) {
    if (this.hasLayerAt(index)) {
      this.currentLayerIndex = index;
    } else {
      window.console.error('Could not set current layer index to ' + index);
    }
  };

  ns.PiskelController.prototype.selectLayer = function (layer) {
    var index = this.getLayers().indexOf(layer);
    if (index != -1) {
      this.setCurrentLayerIndex(index);
    }
  };

  ns.PiskelController.prototype.renameLayerAt = function (index, name) {
    var layer = this.getLayerByIndex(index);
    if (layer) {
      layer.setName(name);
    }
  };

  ns.PiskelController.prototype.setLayerOpacityAt = function (index, opacity) {
    var layer = this.getLayerByIndex(index);
    if (layer) {
      layer.setOpacity(opacity);
    }
  };

  ns.PiskelController.prototype.mergeDownLayerAt = function (index) {
    var layer = this.getLayerByIndex(index);
    var downLayer = this.getLayerByIndex(index - 1);
    if (layer && downLayer) {
      var mergedLayer = pskl.utils.LayerUtils.mergeLayers(layer, downLayer);
      this.removeLayerAt(index);
      this._getPiskel(this.selectedPiskel).addLayerAt(mergedLayer, index);
      this.removeLayerAt(index - 1);
      this.selectLayer(mergedLayer);
    }
  };

  ns.PiskelController.prototype.generateLayerName_ = function () {
    var name = 'Layer ' + this.layerIdCounter;
    while (this.hasLayerForName_(name)) {
      this.layerIdCounter++;
      name = 'Layer ' + this.layerIdCounter;
    }
    return name;
  };

  ns.PiskelController.prototype.duplicateCurrentLayer = function () {
    var layer = this.getCurrentLayer();
    var clone = pskl.utils.LayerUtils.clone(layer);
    var currentLayerIndex = this.getCurrentLayerIndex();
    this._getPiskel(this.selectedPiskel).addLayerAt(clone, currentLayerIndex + 1);
    this.setCurrentLayerIndex(currentLayerIndex + 1);
  };

  ns.PiskelController.prototype.createLayer = function (name) {
    if (!name) {
      name = this.generateLayerName_();
    }
    if (!this.hasLayerForName_(name)) {
      var layer = new pskl.model.Layer(name);
      for (var i = 0 ; i < this.getFrameCount() ; i++) {
        layer.addFrame(this.createEmptyFrame_());
      }
      var currentLayerIndex = this.getCurrentLayerIndex();
      this._getPiskel(this.selectedPiskel).addLayerAt(layer, currentLayerIndex + 1);
      this.setCurrentLayerIndex(currentLayerIndex + 1);
    } else {
      throw 'Layer name should be unique';
    }
  };

  ns.PiskelController.prototype.hasLayerForName_ = function (name) {
    return this._getPiskel(this.selectedPiskel).getLayersByName(name).length > 0;
  };

  ns.PiskelController.prototype.moveLayerUp = function (toTop) {
    var layer = this.getCurrentLayer();
    this._getPiskel(this.selectedPiskel).moveLayerUp(layer, toTop);
    this.selectLayer(layer);
  };

  ns.PiskelController.prototype.moveLayerDown = function (toBottom) {
    var layer = this.getCurrentLayer();
    this._getPiskel(this.selectedPiskel).moveLayerDown(layer, toBottom);
    this.selectLayer(layer);
  };

  ns.PiskelController.prototype.removeCurrentLayer = function () {
    var currentLayerIndex = this.getCurrentLayerIndex();
    this.removeLayerAt(currentLayerIndex);
  };

  ns.PiskelController.prototype.removeLayerAt = function (index) {
    if (!this.hasLayerAt(index)) {
      return;
    }

    var layer = this.getLayerAt(index);
    this._getPiskel(this.selectedPiskel).removeLayer(layer);

    // Update the selected layer if needed.
    if (this.getCurrentLayerIndex() === index) {
      this.setCurrentLayerIndex(Math.max(0, index - 1));
    }
  };

  ns.PiskelController.prototype.serialize = function () {
    return pskl.utils.serialization.Serializer.serialize(this._getPiskel(this.selectedPiskel));
  };

  /**
   * Check if the current sprite is empty. Emptiness here means no pixel has been filled
   * on any layer or frame for the current sprite.
   */
  ns.PiskelController.prototype.isEmpty = function () {
    return pskl.app.currentColorsService.getCurrentColors().length === 0;
  };

  ns.PiskelController.prototype.getPiskelIds = function () {
    return this.piskels.map(p => p.index);
  };

  ns.PiskelController.prototype.getSelectedPiskel = function () {
    return this.selectedPiskel;
  };

  ns.PiskelController.prototype.closePiskel = function (index) {
    const arrayIndex = this.piskels.findIndex(p => p.index == index);

    if (arrayIndex >= 0) {
      if (pskl.app.savedStatusService.isDirty(index)) {
        var msg = 'Your current sprite has unsaved changes. Are you sure you want to quit?';
        if (!window.confirm(msg)) {
          return false;
        }
      }

      this.piskels = this.piskels.filter(p => p.piskel !== this.piskels[arrayIndex].piskel);
      this.selectPiskel(this.piskels[arrayIndex - (arrayIndex > 0 ? 1 : 0)].index);

      return true;
    }

    return false;
  };

  ns.PiskelController.prototype.debug = function () {
    console.log(this.piskels);
  };

  ns.PiskelController.prototype._uuidv4 = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      .replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  };

  ns.PiskelController.prototype._getPiskel = function (index) {
    return this._getPiskelData(index).piskel;
  };

  ns.PiskelController.prototype._getPiskelData = function (index) {
    const arrayIndex = this.piskels.findIndex(p => p.index == index);

    if (arrayIndex >= 0) {
      return this.piskels[arrayIndex];
    }
  };

  ns.PiskelController.prototype._setPiskel = function (index, piskel) {
    const arrayIndex = this.piskels.findIndex(p => p.index == index);

    if (arrayIndex >= 0) {
      this.piskels[arrayIndex].piskel = piskel;
    }
  };
})();
