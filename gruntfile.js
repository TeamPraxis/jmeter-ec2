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
        src: '**/results/*.jtl'
      }
    }
  });


  grunt.loadNpmTasks('grunt-aws');

  grunt.registerTask('publish',         ['s3']);
};
