/* jshint node: true */
'use strict';

var AWS = require('aws-sdk'),
    _ = require('lodash'),
    nconf = require('nconf'),
    async = require('async');

nconf.argv().env();

var ec2 = new AWS.EC2({region: 'us-west-2'}),
    reqNum = (nconf.get('NUM_EC2') || nconf.get('_')[0]),
    instances,
    startNum = 0,
    makeNum = 0;

var startEC2 = function(instances, startNum, makeNum, callback) {
  var startInstances = _.chain(instances)
    .filter({state: 'stopped'})
    .pluck('id')
    .sample(startNum).value();

  console.log('startInstances = ' + startInstances);
  if (startNum > 0) {
    ec2.startInstances({InstanceIds: startInstances}, function(err, data) {
      if (err) {
        console.log('error when starting instances: ', err);
      } else {
        _.each(data.StartingInstances, function(instance) {
          console.dir(instance);
        });
      }
      callback(err, makeNum);
    });
  };
  callback(null, makeNum);
};

var createEC2 = function(makeNum, callback) {
  var params = {
    ImageId: 'ami-f8bdd1c8',
    MaxCount: makeNum,
    MinCount: makeNum,
    InstanceType: 't1.micro',
    KeyName: 'Jenkins',
    SecurityGroups: ['Simple-Web']
  };
  console.log('creating ' + makeNum + ' instances...');
  if (makeNum > 0) {
    ec2.runInstances(params, callback);
  };
};

var createTags = function(instanceIds, callback) {
  var params = {
    Resources: instanceIds,
    Tags: [
      {
        Key: 'Owner',
        Value: 'jmetertest'
      }
    ]
  };
  console.log('params for createTags: ');
  console.dir(params);
  if (instanceIds.length > 0) {
    ec2.createTags(params, callback);
  };
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
        callback('moof', instances, startNum, makeNum);
    } else {
        console.log('need to start ' + (reqNum - (instancesByState.running || 0)) + ' more');
        startNum = reqNum - (instancesByState.running || 0);
        callback(null, instances, startNum, makeNum);
      }
    } else {
      console.log ('gotta start all the stopped ones and make ' + (reqNum - ((instancesByState.running || 0) + (instancesByState.stopped || 0))) + ' more');
      startNum = instancesByState.stopped || 0;
      makeNum = reqNum - ((instancesByState.running || 0) + (instancesByState.stopped || 0));
      callback(null, instances, startNum, makeNum);
    }
    console.log('startNum: ' + startNum);
  },
  startEC2,
  createEC2,
  function(data, callback) {
    var instanceIds = _.pluck(data.Instances, 'InstanceId');
    console.log('created instances: ' + instanceIds);
    callback(null, instanceIds);
  },
  createTags

], function(error, results) {
  if (error) {
    if (error === 'moof') {
      console.log('no action needed, machines are running...')
    } else {
          console.log("waterfall error: " + error);
    }
  } else {
    console.log("no waterfall error");
  }
});
