process.env.test = 'true';

const axios = require('axios')
const server = require('../bin/www')
const https = require('https')
const logger = require('../utils/logger');
const mongoose = require('mongoose')
const userId = mongoose.Types.ObjectId();
const groupId = mongoose.Types.ObjectId();
// const Account = require('../models/account')

require('dotenv').config()
let groupKey;
const instance = axios.create({
  baseURL: `https://localhost:3000`,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});


const createUser = () => {
  return {
    "_id" : aaronsId,
    "username": "avsphere",
    "password": "xxx",
    "email": "avsp.here@tamu.edu",
    "salt": "xxx",
    "hash": "xxx",
    "bio": "living",
    "memberOf" : groupId,
    "maches": ["5aa0a3e3d4d998961cb73292", "5abd471d0a1634b97fd952e7"]
  }
}




const findGroupMembers = () => {
  return new Promise( (resolve, reject) => {
    instance.get('/getUser?username=avsphere')
    .then( (res) => instance.get(`/getGroupMembers?groupKey=abc`) )
    .then( (res) => {
      logger.test('findGroupMembers - should be a number: %s', res.data.length)
      resolve(true);
    })
    .catch( (e) => logger.test('Error - findgroupMembers', e) )
  })

}

const findUser = () => {
  return new Promise( (resolve, reject) => {
    instance.get('/getUser?username=avsphere')
    .then( res => { logger.test('findUser - should be avsphere : %s', res.data.username); return res.data._id })
    .then( id => instance.get(`/getUser?userId=${id}`) )
    .then( res => { logger.test('findUser - should be avsphere : %s', res.data.username); return res.data.email })
    .then( email => instance.get(`/getUser?email=${email}`) )
    .then( res => logger.test('findUser - should be avsphere : %s', res.data.username) )
    .then( _ => resolve(true) )
    .catch( (e) => logger.test('Error - testing findUser %O', e.message) )
  })
}

const findGroup = () => {
  return new Promise( (resolve, reject) => {
    instance.get('/getGroup?groupKey=abc')
    .then( res => {
      logger.test('findGroup - should be ##420Swag : %s', res.data.name);
      return res.data._id;
    })
    .then( groupId => instance.get(`/getGroup?groupId=${groupId}`) )
    .then( res => { logger.test('findGroup - should be ##420Swag : %s', res.data.name); resolve(true); })
    .catch( (e) =>  logger.test('Error - testing findGroup %O', e.message) )
  })
}

const findGroups = () => {
  return new Promise( (resolve, reject) => {
    instance.get('/getGroups?groupKeys=[abc,def]')
    .then( res => {
      logger.test('findGroups - should be ##420Swag BACON: %s %s', res.data.name[0], res.data.name[1]);
      resolve(true);
      // return res.data.map( g => g._id);
    })
    // .then( ids => instance.get(`/getGroups?groupIds=${ids}`) )
    // .then( res => {
    //   logger.test('findGroups - should be ##420Swag BACON: %s %s', res.data.name[0], res.data.name[1]);
    //   resolve(true)
    // })
    .catch( (e) =>  logger.test('Error - testing findGroups %O', e.message) )
  })
}



const createGroup = () => {
  return new Promise( (resolve, reject) => {
    instance.post('/createGroup', {
      "_id" : groupId,
      "creatorId" : userId,
      "adminIds" : [userId],
      "members" : [],
      "name" : "SwagSwag",
      "description" : 'Swag, swag swag... SWAGGGGGG',
    })
    .then( (res) => {
      groupKey = res.data.key;
      logger.test('createGroup - should be SwagSwag : %s', res.data.name);
      resolve(true);
    })
    .catch( (e) =>  logger.test('Error - creategroup %O', e.message) )
  })
}

const deleteGroup = () => {
  return new Promise( (resolve, reject) => {
    instance.post('/deleteGroup', {
      "groupKey" : groupKey
    })
    .then( (res) => {
      logger.test('deleteGroup - should be {success : true} : %O', res.data);
      resolve(true);
    })
    .catch( (e) =>  logger.test('Error - deleteGroup %O', e.message) )
  })
}
createGroup()
.then( _ => findGroupMembers() )
.then( _ => findUser() )
.then( _ => findGroup() )
.then( _ => findGroups() )
.then( _ => deleteGroup() )
.then( _ => process.exit(0) )
.catch( (e) =>  logger.test('Error - tests %O', e.message) )
