var Module;

if (typeof Module === 'undefined') Module = {};

if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;

(function() {
  var loadPackage = function(metadata) {

    // Determine base path dynamically
    var PACKAGE_PATH = '';
    if (typeof document !== 'undefined') {
      // Use the path of the current script or page
      var scripts = document.getElementsByTagName('script');
      var currentScript = scripts[scripts.length - 1].src;
      PACKAGE_PATH = currentScript.substring(0, currentScript.lastIndexOf('/') + 1);
    } else if (typeof location !== 'undefined') {
      PACKAGE_PATH = location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
    } else {
      throw 'Cannot determine package path';
    }

    var PACKAGE_NAME = 'game.data?v=d7e34743-2fea-4de6-8a0e-1103b5fcf07f';
    var REMOTE_PACKAGE_NAME = PACKAGE_PATH + PACKAGE_NAME;
    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
    var PACKAGE_UUID = metadata.package_uuid;

    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', packageName, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function(event) {
        var size = packageSize;
        if (event.total) size = event.total;
        if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
        Module.dataFileDownloads[packageName] = {
          loaded: event.loaded,
          total: size
        };
        if (Module.setStatus) {
          var totalLoaded = 0, totalSize = 0, count = 0;
          for (var url in Module.dataFileDownloads) {
            totalLoaded += Module.dataFileDownloads[url].loaded;
            totalSize += Module.dataFileDownloads[url].total;
            count++;
          }
          totalSize = Math.ceil(totalSize * Module.expectedDataFileDownloads / count);
          Module.setStatus('Downloading data... (' + Math.floor(totalLoaded/1024/1024) + '/' + Math.floor(totalSize/1024/1024) + 'M)');
        }
      };
      xhr.onerror = function() { throw new Error("NetworkError for: " + packageName); };
      xhr.onload = function() {
        if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response)) {
          callback(xhr.response);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    }

    function handleError(error) { console.error('package error:', error); }

    function runWithFS() {
      function DataRequest(start, end) {
        this.start = start;
        this.end = end;
      }
      DataRequest.prototype = {
        requests: {},
        open: function(mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module.addRunDependency('fp ' + this.name);
        },
        send: function() {},
        onload: function() {
          var byteArray = this.byteArray.subarray(this.start, this.end);
          this.finish(byteArray);
        },
        finish: function(byteArray) {
          Module.FS_createDataFile(this.name, null, byteArray, true, true, true);
          Module.removeRunDependency('fp ' + this.name);
          this.requests[this.name] = null;
        }
      };

      for (var i = 0; i < metadata.files.length; ++i) {
        new DataRequest(metadata.files[i].start, metadata.files[i].end).open('GET', metadata.files[i].filename);
      }

      function processPackageData(arrayBuffer) {
        Module.finishedDataFileDownloads++;
        var byteArray = new Uint8Array(arrayBuffer);
        var ptr = Module.getMemory(byteArray.length);
        Module.HEAPU8.set(byteArray, ptr);
        DataRequest.prototype.byteArray = Module.HEAPU8.subarray(ptr, ptr + byteArray.length);

        for (var i = 0; i < metadata.files.length; i++) {
          DataRequest.prototype.requests[metadata.files[i].filename].onload();
        }
        Module.removeRunDependency('datafile_' + PACKAGE_NAME);
      }

      Module.addRunDependency('datafile_' + PACKAGE_NAME);
      fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, processPackageData, handleError);
    }

    if (Module.calledRun) {
      runWithFS();
    } else {
      if (!Module.preRun) Module.preRun = [];
      Module.preRun.push(runWithFS);
    }

  };

  loadPackage({
    "package_uuid": "d7e34743-2fea-4de6-8a0e-1103b5fcf07f",
    "remote_package_size": 10642513,
    "files": [{
      "filename": "/game.love",
      "crunched": 0,
      "start": 0,
      "end": 10642513,
      "audio": false
    }]
  });

})();
