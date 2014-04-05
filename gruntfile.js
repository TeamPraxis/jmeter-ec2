/*jshint node: true */
'use strict';

module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

   
    s3: {
      publish: {
        options: {
          bucket: 'performance.goonies3.com',
          region: 'us-west-2',
          gzip: false,
          cache: false,
          access: 'private'          
        },
        cwd: 's3/',
        src: '*.jtl'
      }
    },

    copy: {
      build: {
        src: '**/results/*.jtl',
        dest: 's3/',
        flatten: true,
        filter: 'isFile'
      }
    }

  });


  grunt.loadNpmTasks('grunt-aws');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('publish',         ['copy', 's3']);
};
