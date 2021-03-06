var fs   = require('fs'),
    os   = require('os'),
    path = require('path'),
    cnst = require('constants');

var mkdirp = require('mkdirp');

/* HELPERS */

var RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;

var environmentVariables = ['TMPDIR', 'TMP', 'TEMP'];

var generateName = function(rawAffixes, defaultPrefix) {
  var affixes = parseAffixes(rawAffixes, defaultPrefix);
  var now = new Date();
  var name = [affixes.prefix,
              now.getYear(), now.getMonth(), now.getDate(),
              '-',
              process.pid,
              '-',
              (Math.random() * 0x100000000 + 1).toString(36),
              affixes.suffix].join('');
  return path.join(exports.dir, name);
}

var parseAffixes = function(rawAffixes, defaultPrefix) {
  var affixes = {prefix: null, suffix: null};
  if(rawAffixes) {
    switch (typeof(rawAffixes)) {
    case 'string':
      affixes.prefix = rawAffixes;
      break;
    case 'object':
      affixes = rawAffixes;
      break
    default:
      throw("Unknown affix declaration: " + affixes);
    }
  } else {
    affixes.prefix = defaultPrefix;
  }
  return affixes;
}

/* EXIT HANDLERS */

/*
 * When any temp file or directory is created, it is added to filesToDelete
 * or dirsToDelete. The first time any temp file is created, a listener is
 * added to remove all temp files and directories at exit.
 */
var exitListenerAttached = false;
var filesToDelete = [];
var dirsToDelete = [];

var deleteFileOnExit = function(filePath) {
  attachExitListener();
  filesToDelete.push(filePath);
};

var deleteDirOnExit = function(dirPath) {
  attachExitListener();
  dirsToDelete.push(dirPath);
};

var attachExitListener = function() {
  if (!exitListenerAttached) {
    process.addListener('exit', cleanup);
    exitListenerAttached = true;
  }
};

var cleanupFiles = function() {
  for (var i=0; i < filesToDelete.length; i++) {
    try { fs.unlinkSync(filesToDelete[i]); }
    catch (rmErr) { /* removed normally */ }
  }
};

var cleanupDirs = function() {
  for (var i=0; i < dirsToDelete.length; i++) {
    try { fs.rmdirSync(dirsToDelete[i]); }
    catch (rmErr) { /* removed normally */ }
  }
};

var cleanup = function() {
  cleanupFiles();
  cleanupDirs();
}

/* DIRECTORIES */

var mkdir = function(affixes, callback) {
  var dirPath = generateName(affixes, 'd-');

  mkdirp(dirPath, 0700, function(err) {
    if (!err) {
      deleteDirOnExit(dirPath);
    }
    if (callback)
      callback(err, dirPath);
  });
}
var mkdirSync = function(affixes) {
  var dirPath = generateName(affixes, 'd-');
  fs.mkdirSync(dirPath, 0700);
  deleteDirOnExit(dirPath);
  return dirPath;
}

/* FILES */

var open = function(affixes, callback) {
  var filePath = generateName(affixes, 'f-')
  fs.open(filePath, RDWR_EXCL, 0600, function(err, fd) {
    if (!err)
      deleteFileOnExit(filePath);
    if (callback)
      callback(err, {path: filePath, fd: fd});
  });
}

var openSync = function(affixes) {
  var filePath = generateName(affixes, 'f-')
  var fd = fs.openSync(filePath, RDWR_EXCL, 0600);
  deleteFileOnExit(filePath);
  return {path: filePath, fd: fd};
}

var createWriteStream = function(affixes) {
  var filePath = generateName(affixes, 's-')
  var stream = fs.createWriteStream(filePath, {flags: RDWR_EXCL, mode: 0600});
  deleteFileOnExit(filePath);
  return stream;
}

/* EXPORTS */
exports.dir               = os.tmpdir();
exports.mkdir             = mkdir;
exports.mkdirSync         = mkdirSync;
exports.open              = open;
exports.openSync          = openSync;
exports.path              = generateName;
exports.cleanup           = cleanup;
exports.createWriteStream = createWriteStream;


