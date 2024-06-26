(function () {
  var ns = $.namespace('pskl');

  ns.PixelUtils = {

    getRectanglePixels : function (x0, y0, x1, y1) {
      var rectangle = this.getOrderedRectangleCoordinates(x0, y0, x1, y1);
      var pixels = [];

      for (var x = rectangle.x0 ; x <= rectangle.x1 ; x++) {
        for (var y = rectangle.y0 ; y <= rectangle.y1 ; y++) {
          pixels.push({'col': x, 'row': y});
        }
      }

      return pixels;
    },

    /**
     * Return an object of ordered rectangle coordinate.
     * In returned object {x0, y0} => top left corner - {x1, y1} => bottom right corner
     * @private
     */
    getOrderedRectangleCoordinates : function (x0, y0, x1, y1) {
      return {
        x0 : Math.min(x0, x1),
        y0 : Math.min(y0, y1),
        x1 : Math.max(x0, x1),
        y1 : Math.max(y0, y1)
      };
    },

    /**
     * Return the list of pixels that would have been filled by a paintbucket tool applied
     * on pixel at coordinate (x,y).
     * This function is not altering the Frame object argument.
     *
     * @param frame pskl.model.Frame The frame target in which we want to paintbucket
     * @param col number Column coordinate in the frame
     * @param row number Row coordinate in the frame
     *
     * @return an array of the pixel coordinates paint with the replacement color
     */
    getSimilarConnectedPixelsFromFrame: function(frame, col, row) {
      var targetColor = frame.getPixel(col, row);
      if (targetColor === null) {
        return [];
      }

      var startPixel = {
        col : col,
        row : row
      };

      var visited = {};
      return pskl.PixelUtils.visitConnectedPixels(startPixel, frame, function (pixel) {
        var key = pixel.col + '-' + pixel.row;
        if (visited[key]) {
          return false;
        }
        visited[key] = true;
        return frame.getPixel(pixel.col, pixel.row) == targetColor;
      });
    },

    /**
     * Resize the pixel at {col, row} for the provided size. Will return the array of pixels centered
     * around the original pixel, forming a pixel square of side=size
     *
     * @param  {Number} row  x-coordinate of the original pixel
     * @param  {Number} col  y-coordinate of the original pixel
     * @param  {Number} size >= 1 && <= 32
     * @return {Array}  array of arrays of 2 Numbers (eg. [[0,0], [0,1], [1,0], [1,1]])
     */
    resizePixel : function (col, row, size) {
      var pixels = [];

      for (var j = 0; j < size; j++) {
        for (var i = 0; i < size; i++) {
          pixels.push([col - Math.floor(size / 2) + i, row - Math.floor(size / 2) + j]);
        }
      }

      return pixels;
    },

    /**
     * Shortcut to reduce the output of pskl.PixelUtils.resizePixel for several pixels
     * @param  {Array}  pixels Array of pixels (objects {col:Number, row:Number})
     * @param  {Number} >= 1 && <= 4
     * @return {Array}  array of arrays of 2 Numbers (eg. [[0,0], [0,1], [1,0], [1,1]])
     */
    resizePixels : function (pixels, size) {
      return pixels.reduce(function (p, pixel) {
        return p.concat(pskl.PixelUtils.resizePixel(pixel.col, pixel.row, size));
      }, []);
    },

    /**
     * Apply the paintbucket tool in a frame at the (col, row) initial position
     * with the replacement color.
     *
     * @param frame pskl.model.Frame The frame target in which we want to paintbucket
     * @param col number Column coordinate in the frame
     * @param row number Row coordinate in the frame
     * @param replacementColor string Hexadecimal color used to fill the area
     *
     * @return an array of the pixel coordinates paint with the replacement color
     */
    paintSimilarConnectedPixelsFromFrame: function(frame, col, row, replacementColor) {
      /**
       *  Queue linear Flood-fill (node, target-color, replacement-color):
       *   1. Set Q to the empty queue.
       *   2. If the color of node is not equal to target-color, return.
       *   3. Add node to Q.
       *   4. For each element n of Q:
       *   5.     If the color of n is equal to target-color:
       *   6.         Set w and e equal to n.
       *   7.         Move w to the west until the color of the node to the west of w no longer matches target-color.
       *   8.         Move e to the east until the color of the node to the east of e no longer matches target-color.
       *   9.         Set the color of nodes between w and e to replacement-color.
       *  10.         For each node n between w and e:
       *  11.             If the color of the node to the north of n is target-color, add that node to Q.
       *  12.             If the color of the node to the south of n is target-color, add that node to Q.
       *  13. Continue looping until Q is exhausted.
       *  14. Return.
       */
      if (typeof replacementColor == 'string') {
        replacementColor = pskl.utils.colorToInt(replacementColor);
      }

      var targetColor;
      try {
        targetColor = frame.getPixel(col, row);
      } catch (e) {
        // Frame out of bound exception.
      }

      if (targetColor === null || targetColor == replacementColor) {
        return;
      }

      var startPixel = {
        col : col,
        row : row
      };
      var paintedPixels = pskl.PixelUtils.visitConnectedPixels(startPixel, frame, function (pixel) {
        if (frame.getPixel(pixel.col, pixel.row) == targetColor) {
          frame.setPixel(pixel.col, pixel.row, replacementColor);
          return true;
        }
        return false;
      });
      return paintedPixels;
    },

    /**
     * Apply the outliner tool in a frame at the (col, row) initial position
     * with the replacement color.
     *
     * @param frame pskl.model.Frame The frame target in which we want to paintbucket
     * @param col number Column coordinate in the frame
     * @param row number Row coordinate in the frame
     * @param replacementColor string Hexadecimal color used to fill the area
     * @param fillCorners boolean If true, also paint corner pixels
     *
     * @return an array of the pixel coordinates paint with the replacement color
     */
    outlineSimilarConnectedPixelsFromFrame: function(frame, col, row, replacementColor, fillCorners) {
      /**
       * Acts like floodfill, except that a given pixel is only painted if it has at
       * least one non-filled-color neighbor.
       * 
       */
      if (typeof replacementColor == 'string') {
        replacementColor = pskl.utils.colorToInt(replacementColor);
      }

      if (fillCorners===undefined) {
        fillCorners = false;
      }

      var targetColor;
      try {
        targetColor = frame.getPixel(col, row);
      } catch (e) {
        // Frame out of bound exception.
      }

      if (targetColor === null || targetColor == replacementColor) {
        return;
      }

      var atLeastOneNeighborHasNonTargetColor = function(pixel) {
        for (var y = -1; y <= 1; y++ ) {
          for (var x = -1; x <= 1; x++ ) {
            if (x != 0 || y != 0) {
              if (fillCorners || (x == 0 || y == 0)) {
                try {
                  var pixelColor = frame.getPixel(pixel.col + x, pixel.row + y);
                  if ( pixelColor !== null && pixelColor !== targetColor) {
                    return true;
                  }
                } catch (e) {
                  // Frame out of bound exception.
                }
              }
            }
          }
        }
        return false;
      };

      var pixels = pskl.PixelUtils.getSimilarConnectedPixelsFromFrame(frame, col, row);
      pixels = pixels.filter(pixel => atLeastOneNeighborHasNonTargetColor(pixel));

      var paintedPixels = [];

      for (var pixel of pixels) {
        frame.setPixel(pixel.col, pixel.row, replacementColor);
        paintedPixels.push(pixel);
      }

      return paintedPixels;
    },

    /**
     * Starting from a provided origin, visit connected pixels using a visitor function.
     * After visiting a pixel, select the 4 connected pixels (up, right, down, left).
     * Call the provided visitor on each pixel. The visitor should return true if the
     * pixel should be considered as connected. If the pixel is connected repeat the
     * process with its own connected pixels
     *
     * TODO : Julian : The visitor is also responsible for making sure a pixel is never
     * visited twice. This could be handled by default by this method.
     *
     * @return {Array} the array of visited pixels {col, row}
     */
    visitConnectedPixels : function (pixel, frame, pixelVisitor) {
      var col = pixel.col;
      var row = pixel.row;

      var queue = [];
      var visitedPixels = [];
      var dy = [-1, 0, 1, 0];
      var dx = [0, 1, 0, -1];

      queue.push(pixel);
      visitedPixels.push(pixel);
      pixelVisitor(pixel);

      var loopCount = 0;
      var cellCount = frame.getWidth() * frame.getHeight();
      while (queue.length > 0) {
        loopCount++;

        var currentItem = queue.pop();

        for (var i = 0; i < 4; i++) {
          var nextCol = currentItem.col + dx[i];
          var nextRow = currentItem.row + dy[i];
          try {
            var connectedPixel = {'col': nextCol, 'row': nextRow};
            var isValid = pixelVisitor(connectedPixel);
            if (isValid) {
              queue.push(connectedPixel);
              visitedPixels.push(connectedPixel);
            }
          } catch (e) {
            // Frame out of bound exception.
          }
        }

        // Security loop breaker:
        if (loopCount > 10 * cellCount) {
          console.log('loop breaker called');
          break;
        }
      }

      return visitedPixels;
    },

    /**
     * Calculate and return the maximal zoom level to display a picture in a given container.
     *
     * @param container jQueryObject Container where the picture should be displayed
     * @param number pictureHeight height in pixels of the picture to display
     * @param number pictureWidth width in pixels of the picture to display
     * @return number maximal zoom
     */
    calculateZoomForContainer : function (container, pictureHeight, pictureWidth) {
      return this.calculateZoom(container.height(), container.width(), pictureHeight, pictureWidth);
    },

    /**
     * Bresenham line algorithm: Get an array of pixels from
     * start and end coordinates.
     *
     * http://en.wikipedia.org/wiki/Bresenham's_line_algorithm
     * http://stackoverflow.com/questions/4672279/bresenham-algorithm-in-javascript
     */
    getLinePixels : function (x0, x1, y0, y1) {
      var pixels = [];

      x1 = pskl.utils.normalize(x1, 0);
      y1 = pskl.utils.normalize(y1, 0);

      var dx = Math.abs(x1 - x0);
      var dy = Math.abs(y1 - y0);

      var sx = (x0 < x1) ? 1 : -1;
      var sy = (y0 < y1) ? 1 : -1;

      var err = dx - dy;
      while (true) {
        // Do what you need to for this
        pixels.push({'col': x0, 'row': y0});

        if ((x0 == x1) && (y0 == y1)) {
          break;
        }

        var e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x0  += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0  += sy;
        }
      }

      return pixels;
    },

    /**
     * Create a uniform line using the same number of pixel at each step, between the provided
     * origin and target coordinates.
     */
    getUniformLinePixels : function (x0, x1, y0, y1) {
      var pixels = [];

      x1 = pskl.utils.normalize(x1, 0);
      y1 = pskl.utils.normalize(y1, 0);

      var dx = Math.abs(x1 - x0) + 1;
      var dy = Math.abs(y1 - y0) + 1;

      var sx = (x0 < x1) ? 1 : -1;
      var sy = (y0 < y1) ? 1 : -1;

      var ratio = Math.max(dx, dy) / Math.min(dx, dy);
      // in pixel art, lines should use uniform number of pixels for each step
      var pixelStep = Math.round(ratio) || 0;

      if (pixelStep > Math.min(dx, dy)) {
        pixelStep = Infinity;
      }

      var maxDistance = pskl.utils.Math.distance(x0, x1, y0, y1);

      var x = x0;
      var y = y0;
      var i = 0;
      while (true) {
        i++;

        pixels.push({'col': x, 'row': y});
        if (pskl.utils.Math.distance(x0, x, y0, y) >= maxDistance) {
          break;
        }

        var isAtStep = i % pixelStep === 0;
        if (dx >= dy || isAtStep) {
          x += sx;
        }
        if (dy >= dx || isAtStep) {
          y += sy;
        }
      }

      return pixels;
    },
    getNoiseColor: function() {
      const colors = [0, -0.25, -0.5, -0.75, -1];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return pskl.PixelUtils.pSBC(color, pskl.app.selectedColorsService.getPrimaryColor(), pskl.app.selectedColorsService.getSecondaryColor(), true);
    },
    paintNoiseSimilarConnectedPixelsFromFrame: function(frame, col, row) {
      /**
       *  Queue linear Flood-fill (node, target-color, replacement-color):
       *   1. Set Q to the empty queue.
       *   2. If the color of node is not equal to target-color, return.
       *   3. Add node to Q.
       *   4. For each element n of Q:
       *   5.     If the color of n is equal to target-color:
       *   6.         Set w and e equal to n.
       *   7.         Move w to the west until the color of the node to the west of w no longer matches target-color.
       *   8.         Move e to the east until the color of the node to the east of e no longer matches target-color.
       *   9.         Set the color of nodes between w and e to replacement-color.
       *  10.         For each node n between w and e:
       *  11.             If the color of the node to the north of n is target-color, add that node to Q.
       *  12.             If the color of the node to the south of n is target-color, add that node to Q.
       *  13. Continue looping until Q is exhausted.
       *  14. Return.
       */
      const replacementColor = pskl.utils.colorToInt(pskl.PixelUtils.getNoiseColor());
  
      var targetColor;
      try {
        targetColor = frame.getPixel(col, row);
      } catch (e) {
        // Frame out of bound exception.
      }
  
      if (targetColor === null || targetColor == replacementColor) {
        return;
      }
  
      var startPixel = {
        col : col,
        row : row
      };
      var paintedPixels = pskl.PixelUtils.visitConnectedPixels(startPixel, frame, function (pixel) {
        if (frame.getPixel(pixel.col, pixel.row) == targetColor) {
          frame.setPixel(pixel.col, pixel.row, pskl.utils.colorToInt(pskl.PixelUtils.getNoiseColor()));
          return true;
        }
        return false;
      });
      return paintedPixels;
    },
    pSBCr: function (d) {
      let n = d.length;
      let x = {};
      if (n > 9)
      {
        [r, g, b, a] = d = d.split(",");
        n = d.length;
        if (n < 3 || n > 4)
        {
          return null;
        }
  
        x.r = parseInt(r[3] == "a" ? r.slice(5) : r.slice(4));
        x.g = parseInt(g);
        x.b = parseInt(b);
        x.a = a ? parseFloat(a) : -1;
      }
      else 
      {
        if (n == 8 || n == 6 || n < 4)
        {
          return null;
        }
  
        if (n < 6)
        {
          d = "#" + d[1] + d[1] + d[2] + d[2] + d[3] + d[3] + (n > 4 ? d[4] + d[4] : "");
        }
        
        d = parseInt(d.slice(1), 16);
        if (n == 9 || n == 5)
        {
          x.r = d >> 24 & 255;
          x.g = d >> 16 & 255;
          x.b = d >> 8 & 255;
          x.a = Math.round((d & 255) / 0.255) / 1000;
        }
        else
        {
          x.r = d >> 16;
          x.g = d >> 8 & 255;
          x.b = d & 255;
          x.a = -1;
        }
  
      }
      
      return x;
    },
    pSBC : function (p, c0, c1, l) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = typeof (c1) == "string";
      let P, f, t, h;
      if (typeof (p) != "number" || 
        p < -1 || p > 1 || typeof (c0) != "string" || 
        (c0[0] != 'r' && c0[0] != '#') || (c1 && !a))
      {
        return null;
      }
  
      h = c0.length > 9;
      h = a ? c1.length > 9 ? true : c1 == "c" ? !h : false : h;
      f = pskl.PixelUtils.pSBCr(c0);
      P = p < 0;
      t = c1 && c1 != "c" ? pskl.PixelUtils.pSBCr(c1) : P ? { r: 0, g: 0, b: 0, a: -1 } : { r: 255, g: 255, b: 255, a: -1 };
      p = P ? p * -1 : p;
      P = 1 - p;
  
      if (!f || !t)
      {
        return null;
      }
      if (l)
      {
        r = Math.round(P * f.r + p * t.r);
        g = Math.round(P * f.g + p * t.g);
        b = Math.round(P * f.b + p * t.b);
      }
      else
      {
        r = Math.round((P * f.r ** 2 + p * t.r ** 2) ** 0.5);
        g = Math.round((P * f.g ** 2 + p * t.g ** 2) ** 0.5);
        b = Math.round((P * f.b ** 2 + p * t.b ** 2) ** 0.5);
      }
  
      a = f.a;
      t = t.a;
      f = a >= 0 || t >= 0;
      a = f ? a < 0 ? t : t < 0 ? a : a * P + t * p : 0;
  
      if (h)
      {
        return "rgb" + (f ? "a(" : "(") + r + "," + g + "," + b + (f ? "," + Math.round(a * 1000) / 1000 : "") + ")";
      }
      
      return "#" + (4294967296 + r * 16777216 + g * 65536 + b * 256 + (f ? Math.round(a * 255) : 0)).toString(16).slice(1, f ? undefined : -2)
    }
  };
})();
