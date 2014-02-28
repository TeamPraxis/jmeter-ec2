/* jshint node: true */
'use strict';

var AWS = require('aws-sdk'),
    _ = require('lodash');

var ec2 = new AWS.EC2({region: 'us-west-2'}),
    reqNum = 1;

ec2.describeInstances(function(error, data) {
  if (error) {
    console.log(error); // an error occurred
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
    console.log("state totals: ");
    var instancesByState = _.countBy(instances, 'state');
    console.dir(instancesByState);

    if (reqNum <= ((instancesByState.running || 0) + (instancesByState.stopped || 0))) {
      if (reqNum <= (instancesByState.running || 0)) {
        console.log('just enough running!');
      } else {
        console.log('need to start ' + (reqNum - (instancesByState.running || 0)) + ' more');
      }
    } else {
      console.log ('gotta start all the stopped ones and make ' + (reqNum - ((instancesByState.running || 0) + (instancesByState.stopped || 0))) + ' more');
      //start all the stopped ones
      //create number of extra machines
    }
  }

});

