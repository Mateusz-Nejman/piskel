(function () {
  var ns = $.namespace('pskl.service.storage');

  ns.FileDownloadStorageService = function () {};
  ns.FileDownloadStorageService.prototype.init = function () {};

  ns.FileDownloadStorageService.prototype.save = function (piskel) {
    var serialized = pskl.utils.serialization.Serializer.serialize(piskel);
    var deferred = Q.defer();

    pskl.utils.BlobUtils.stringToBlob(serialized, function(blob) {
      var piskelName = piskel.getDescriptor().name;
      var fileName = piskelName + '.piskel';

      try {
        pskl.utils.FileUtils.downloadAsFile(blob, fileName);
        deferred.resolve();
      } catch (e) {
        deferred.reject(e.message);
      }
    }.bind(this), 'application/piskel+json');

    return deferred.promise;
  };

})();
