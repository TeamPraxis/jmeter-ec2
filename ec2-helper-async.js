/* jshint node: true */
'use strict';

var AWS = require('aws-sdk'),
    _ = require('lodash'),
    nconf = require('nconf'),
    async = require('async');

nconf.argv().env();

var ec2 = new AWS.EC2({region: 'us-west-2'}),
    reqNum = (nconf.get('_')[0] || nconf.get('NUM_EC2')),
    instances,
    startNum = 0,
    makeNum = 0;

var startEC2 = function(instances, startNum, callback) {
  var startInstances = _.chain(instances)
    .filter({state: 'stopped'})
    .pluck('id')
    .sample(startNum).value();
  console.log('startInstances = ' + startInstances);
  ec2.startInstances({InstanceIds: startInstances}, callback);
};

async.waterfall([
  _.bind(ec2.describeInstances, ec2),
  function(data, callback) {
    instances = _.chain(data.Reservations)
      .pluck('Instances')
      .flatten()
      .filter(function(i) {
        return _.any(i.Tags, {Key: "Owner", Value: "jmetertest"});
      })
      .map(function (i) {
        return {
          id: i.InstanceId,
          state: i.State.Name
        };
      }).value();
    console.log(instances.length + " JMeter instances:\n ", instances);
    var instancesByState = _.countBy(instances, 'state');
    console.dir(instancesByState);
    if (reqNum <= ((instancesByState.running || 0) + (instancesByState.stopped || 0))) {
      if (reqNum <= (instancesByState.running || 0)) {
        callback('moof', instances, startNum);
    } else {
        console.log('need to start ' + (reqNum - (instancesByState.running || 0)) + ' more');
        startNum = reqNum - (instancesByState.running || 0);
        callback(null, instances, startNum);
      }
    } else {
      console.log ('gotta start all the stopped ones and make ' + (reqNum - ((instancesByState.running || 0) + (instancesByState.stopped || 0))) + ' more');
      startNum = instancesByState.stopped || 0;
      callback(null, instances, startNum);
    }
    console.log('startNum: ' + startNum);
  },
  startEC2,
  function(data, callback) {
    _.each(data.StartingInstances, function(instance) {
      console.dir(instance);
    });
    callback(null, data);
  }

], function(error, results) {
  if (error) {
    if (error === 'moof') {
      console.log('all required machines are started and running...')
    } else {
          console.log("waterfall error: " + error);
    }
  } else {
    console.log("no waterfall error");
  }
});
