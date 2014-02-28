/* jshint node: true */
'use strict';

var AWS = require('aws-sdk'),
    _ = require('lodash'),
    nconf = require('nconf');

nconf.argv().env();

var ec2 = new AWS.EC2({region: 'us-west-2'}),
    reqNum = nconf.get('NUM_EC2');

console.log('num_ec2: ' + reqNum);

ec2.describeInstances(function(error, data) {
  if (error) {
    console.log('describeInstances error: ' + error);
  } else {
    var instances = _.chain(data.Reservations)
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
        console.log('just enough running!');
      } else {
        console.log('need to start ' + (reqNum - (instancesByState.running || 0)) + ' more');
        console.log('which ones? ' + _.filter(instances, {state: 'stopped'}));
      }
    } else {
      console.log ('gotta start all the stopped ones and make ' + (reqNum - ((instancesByState.running || 0) + (instancesByState.stopped || 0))) + ' more');
      var startInstances = _.chain(instances)
        .filter({state: 'stopped'})
        .pluck('id')
        .sample((instancesByState.stopped || 0)).value();
      console.log('startInstances = ' + startInstances);
      ec2.startInstances({InstanceIds: startInstances}, function(error, data) {
        if (error) {
          console.log('startInstances error: ' + error);
        } else {
          console.log('startInstances data: ');
          console.dir(data);
          //wait for instances to all start

        }
      });
      //start all the stopped ones
      //create number of extra machines
    }
  }

});

