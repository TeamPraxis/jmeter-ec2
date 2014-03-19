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
    startNum = 0;

var startEC2 = function(instances, startNum, makeNum, runningInstances, callback) {
  var startInstances = _.chain(instances)
    .filter({state: 'stopped'})
    .pluck('id')
    .sample(startNum).value();

  if (startNum > 0) {
    ec2.startInstances({InstanceIds: startInstances}, function(err, data) {
      callback(err, makeNum, _.union(startInstances, runningInstances));
    });
  } else {
    callback(null, makeNum, runningInstances);
  };
};

var createEC2 = function(makeNum, instanceList, callback) {
  var params = {
    ImageId: process.env.AMI_ID, 
    MaxCount: makeNum,
    MinCount: makeNum,
    InstanceType: process.env.INSTANCE_TYPE,
    KeyName: process.env.AMAZON_KEYPAIR_NAME,
    SecurityGroups: [process.env.INSTANCE_SECURITYGROUP]
  };
  
  if (makeNum > 0) {
    ec2.runInstances(params, function(err, data) {
      if(err) {
        callback(err);
      } else {
        var instanceIds = _.pluck(data.Instances, 'InstanceId');
        callback(null, _.union(instanceList, instanceIds), instanceIds);
      }
    });
  } else {
    callback(null, instanceList, null);
  };
};

var createTags = function(instanceList, instanceIds, callback) {
  var params = {
    Resources: instanceIds,
    Tags: [
      {
        Key: 'Owner',
        Value: 'jmetertest'
      }
    ]
  };
  if (instanceIds) {
    ec2.createTags(params, function(err, data) {
      callback(err, instanceList);
    });
  } else {
    callback(null, instanceList);
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

    var instancesByState = _.countBy(instances, 'state');
    var running = (instancesByState.running || 0),
        stopped = (instancesByState.stopped || 0), 
        available = running + stopped,
        runningInstances = _.chain(instances)
          .filter({state: 'running'})
          .pluck('id').value();

    if (reqNum <= available) {
      if (reqNum <= running) {
        callback('moof', _.sample(runningInstances, reqNum));
      } else {          
        startNum = (reqNum - running);
        callback(null, instances, startNum, 0, runningInstances);
      }
    } else {
      startNum = stopped;
      var makeNum = (reqNum - available);
      callback(null, instances, startNum, makeNum, runningInstances);
    }
  },
  startEC2,
  createEC2,
  createTags

], function(error, results) {
  if (error) {
    if (error === 'moof') {
      console.log(results.toString().replace(/,/g, ' '));
    } else {
      console.error("waterfall error: " + error);
      process.exit(1);
    }
  } else {
    console.log(results.toString().replace(/,/g, ' '));
  }
});
