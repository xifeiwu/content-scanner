const path = require('path');
var gulp = require('gulp');                  // gulp插件
var concat = require('gulp-concat');
var del = require('del');
var rename = require('gulp-rename');

const uglifyes = require('uglify-es');
const composer = require('gulp-uglify/composer');
const uglify = composer(uglifyes, console);

const SRC_DIR = path.resolve('src/js');
const DEST_DIR = path.resolve('dist/js');


gulp.task('clean', function() {
  return del.sync([DEST_DIR + '*'], {
    force: true
  });
});

gulp.task('background', function() {
  var stream = gulp.src([
    'libs/aes.js',
    'libs/md5.js',
    'common/utils.js',
    'libs/axios.js',
    'background/tabs.js',
    'common/storage.js',
    'background/net.js',
    'background.js'
  ].map(file => path.resolve(SRC_DIR, file)))
  .pipe(concat('background.min.js'))
  .pipe(uglify())
  .pipe(gulp.dest(DEST_DIR));
  return stream
});

gulp.task('content', function() {
  var stream = gulp.src([
    'common/utils.js',
    'content.js'
  ].map(file => path.resolve(SRC_DIR, file)))
  .pipe(concat('content.min.js'))
  .pipe(uglify())
  .pipe(gulp.dest(DEST_DIR));
  return stream
});

/*********** HTML + CSS + JavaScript ***********/
gulp.task('build', ['clean', 'background', 'content'], function(){
  console.log('complete');
});
