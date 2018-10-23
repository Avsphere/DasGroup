const Account = require('../../models/account')
const Group = require('../../models/group')
const logger = require('../../utils/logger');
const helpers = require('../helpers/helpers')
const RequestError = require('../../utils/errors/RequestError')
const logic = {};

const uniq = helpers.uniq;
const getQuery = helpers.getQuery;
const findGroup = helpers.findGroup;
const isUserAdminOfGroup = helpers.isUserAdminOfGroup;



logic.renderGroup = (req, res) => {
  let locator = req.params.locator
  let query = locator.length === 24 ? getQuery({ groupId : locator }) : getQuery({groupKey : locator})
  findGroup(query, { populate : { name : 'members', returnOnly : 'username' } })
  .then( group => {
    if ( group ) {
      req.user.currentGroup = group;
      res.render('group', {user : req.user, group : group })
     }
    else { res.render('error', {message : "No such group exists"} )}
  })
  .catch( (e) => {
    logger.error('Error in renderGroup %j %O', req.query, e)
    res.status(404);
    res.send([])
  })
}

logic.renderRoot = (req, res) => {
  if ( req.user.memberOf.length < 1 ) { res.render('index', {user : req.user, groups : [] }) }
  else {
    let groupQuery = getQuery({ groupIds : req.user.memberOf });
    findGroup(groupQuery)
    .then( groups => {
      if ( !Array.isArray(groups) ) { groups = [groups]; }
      req.user.currentGroup = {};
      res.render('index', {user : req.user, groups : groups })
    })
    .catch( (e) => {
      logger.error('Error in renderRoot %j %O', req.query, e)
      res.status(404);
      res.send([])
    })
  }
}

//This getGroups differs from the Account model method in that it takes a list of groupIds or keys where the account model expects a user
logic.getGroups = (req, res) => {
  const query = getQuery(req.query);
  findGroup(query)
  .then( groups => {
    if ( Array.isArray(groups) ) { res.send(groups); }
    else { res.send([groups]) }
  })
  .catch( (e) => {
    logger.error('Error in getGroups %j %O', req.query, e)
    res.status(404);
    res.send([])
  })
};


logic.getGroupMembers = (req, res) => {
  const query = getQuery(req.query);
  findGroup(query)
  .then( group => group.getGroupMembers(Account) )
  .then( members => res.send(members) )
  .catch( (e) => {
    logger.error('Error in getGroupMembers %j %O', req.query, e)
    res.status(404);
    res.send([])
  })
}
//takes a groupId/key -- only updates passed fields
logic.updateGroup = (req, res) => {
  const query = getQuery(req.body.groupQuery);
  isUserAdminOfGroup(query, req.user)
  .then( adminStatus => {
    if ( !adminStatus.isAdmin ) { throw new RequestError('User is not authorized to update this group', 1) }
    const group = adminStatus.group;
    if ( req.body.hasOwnProperty('visibility') ) {
      group.visibility = req.body.visibility;
    }
    if ( req.body.hasOwnProperty('name') ) {
      group.name = req.body.name;
    }
    if ( req.body.hasOwnProperty('description') ) {
      group.description = req.body.description;
    }
    return group.save();
  })
  .then( updatedGroup => res.send(updatedGroup) )
  .catch( e => {
    logger.error('Error in updateGroup %j %O %O', req.groupQuery, req.user, e)
    res.status(404);
    res.send({})
  })
}



logic.joinGroup = (req, res) => {
  const query = getQuery(req.body);
  let updatedGroup = {}, sendOnError = true;
  findGroup(query)
  .then( group => {
    const groupMembers = group.members.map( mem => mem.toString() )
    if ( !groupMembers.includes( req.user._id.toString() ) && group.visibility.toString() === 'public' ) {
      group.members.push(req.user._id);
      return group.save();
    } else if ( group.visibility.toString() === 'private' ) {
      throw new RequestError('user is trying to join non public group')
    } else {
      //In this case the user is already part of the group, and so I want to break out of the chain
      res.send(group)
      sendOnError = false;
      throw new RequestError('User is trying to join a group that they are already a part of')
    }
  })
  .then( savedGroup => {
    updatedGroup = savedGroup;
    return helpers.addGroupToUser({ _id : req.user._id}, updatedGroup._id)
  })
  .then( updatedUser => {
    res.send(updatedGroup);
  })
  .catch( e => {
    logger.error('Error in joinGroup %j %O %O', req.body, req.user, e)
    if ( sendOnError ) {
      res.status(404);
      res.send({})
    }
  })
}

logic.leaveGroup = (req, res) => {
  const query = getQuery(req.body);
  findGroup(query)
  .then( group => {
    const groupIndexToRemove = group.members.indexOf(req.user._id);
    const accountIndexToRemove = req.user.memberOf.indexOf(group._id);
    const adminIndexToRemove = group.roles.admins.indexOf(req.user._id);
    if ( groupIndexToRemove === -1 || accountIndexToRemove === -1) { throw new RequestError('User cannot leave group they are not a member of') }
    if ( adminIndexToRemove !== -1 ) {
       group.roles.admins.splice(adminIndexToRemove, 1);
    }
    group.members.splice(groupIndexToRemove, 1)
    req.user.memberOf.splice(accountIndexToRemove, 1)
    return Promise.all( [req.user.save(), group.save()] );
  })
  .then( updatedUserAndGroup => {
    res.send({updatedUserAndGroup : updatedUserAndGroup})
  })
  .catch( e => {
    logger.error('Error in leaveGroup %j %O %O', req.body, req.user, e)
  })
}

//Strictly for testing req.body : { groupQuery : {}, newMembers : [userId]}
logic.addGroupMembers = (req, res) => {
  const query = getQuery(req.body.groupQuery);
  let group, userChecks, newGroupMembers;
  isUserAdminOfGroup(query, req.user)
  .then( adminStatus => {
    if ( !adminStatus.isAdmin ) { throw new RequestError('User is not authorized to add members this group', 1) }
    group = adminStatus.group;
    userChecks = req.body.newMembers.map( m => helpers.checkUserExists(m) )
    newGroupMembers = uniq(group.members.concat(req.body.newMembers))
    return Promise.all(userChecks)
  })
  .then( usersExist => {
    usersExist.forEach( c => { if ( c !== true ) { throw new RequestError('Cannot add nonexistant user to group') } })
    group.members = newGroupMembers
    return group.save()
  })
  .then( updatedGroup => {
    group = updatedGroup;
    return Promise.all( newGroupMembers.map( m => helpers.addGroupToUser({ _id : m }, updatedGroup._id) ) )
  })
  .then( updatedUsers => res.send(group) )
  .catch( e => {
    logger.error('Error in addGroupMembers %j %O %O', req.body, req.user, e)
    res.status(404);
    res.send({})
  })
}

//NOT TESTED groupQuery, newAdmins [userIds]
logic.addGroupAdmins = (req, res) => {
  const query = getQuery(req.body.groupQuery);
  let group, userChecks, newAdmins;
  isUserAdminOfGroup(query, req.user)
  .then( adminStatus => {
    if ( !adminStatus.isAdmin ) { throw new RequestError('User is not authorized to add admins this group', 1) }
    group = adminStatus.group;
    userChecks = req.body.newAdmins.map( m => helpers.checkUserExists(m) )
    newAdmins = uniq(group.roles.admins.concat(req.body.newAdmins))
    newMembers = uniq(group.members.concat(req.body.newAdmins))
    return Promise.all(userChecks)
  })
  .then( usersExist => {
    usersExist.forEach( c => { if ( c !== true ) { throw new RequestError('Cannot add nonexistant user to group admins') } })
    group.roles.admins = newAdmins
    group.members = newMembers;
    return group.save()
  })
  .then( updatedGroup => {
    group = updatedGroup;
    return Promise.all( newAdmins.map( m => helpers.addGroupToUser({ _id : m }, updatedGroup._id) ) )
  })
  .then( updatedUsers => res.send(group) )
  .catch( e => {
    logger.error('Error in addGroupAdmins %j %O %O', req.body, req.user, e)
    res.status(404);
    res.send({})
  })
}

logic.removeGroupAdmins = (req, res) => {
  const query = getQuery(req.body.groupQuery);
  let group, removeAdmins;
  isUserAdminOfGroup(query, req.user)
  .then( adminStatus => {
    if ( !adminStatus.isAdmin ) { throw new RequestError('User is not authorized to add admins this group', 1) }
    group = adminStatus.group;
    group.roles.admins = group.roles.admins.filter( adminId => !req.body.removeAdmins.includes( adminId.toString() ) )
    return group.save()
  })
  .then( updatedGroup => res.send(updatedGroup))
  .catch( e => {
    logger.error('Error in removeGroupAdmins %j %O %O', req.body, req.user, e)
    res.status(404);
    res.send({})
  })
}

logic.removeGroupMembers = (req, res) => {
  const query = getQuery(req.body.groupQuery);
  let group, removeUsers;
  isUserAdminOfGroup(query, req.user)
  .then( adminStatus => {
    if ( !adminStatus.isAdmin ) { throw new RequestError('User is not authorized to remove users this group', 1) }
    group = adminStatus.group;
    group.members = group.members.filter( memberId => !req.body.removeUsers.includes( memberId.toString() ) )
    return group.save()
  })
  .then( updatedGroup => res.send(updatedGroup))
  .catch( e => {
    logger.error('Error in removeGroupMembers %j %O %O', req.body, req.user, e)
    res.status(404);
    res.send({})
  })
}

logic.createGroup = (req, res) => {
  let createdGroup = {}
  req.body.members.push(req.user._id.toString());
  req.body.adminIds.push(req.user._id.toString());
  if ( req.body.visibility !== 'public' || req.body.visibility !== 'private' ) { req.body.visibility = 'public' }
  const g = new Group({
    "creator" : req.user._id,
    "roles.admins" : uniq(req.body.adminIds),
    "members" : uniq(req.body.members),
    "visibility" : req.body.visibility,
    "name" : req.body.name,
    "description" : req.body.description
  })
  g.save()
  .then( newGroup => {
    createdGroup = newGroup;
    return helpers.addGroupToUser({ _id : req.user._id}, newGroup._id)
  })
  .then( updatedUser => {
    res.send(createdGroup)
  })
  .catch( e => {
    res.status(404);
    logger.error('Error in createGroup %O %O', req.body, e)
    res.send({})
  })
}


logic.deleteGroup = (req, res) => {
  const groupQuery = getQuery(req.body);
  isUserAdminOfGroup(groupQuery, req.user)
  .then( adminStatus => {
    if ( !adminStatus.isAdmin ) { throw new RequestError('User is not authorized to delete this group', 1) }
    return adminStatus.group.pseudoRemove()
  })
  .then( _ => res.send({success : true }))
  .catch( e => {
    logger.error('Error in deleteGroup body : %O user : %O error : %O', req.body, req.user, e)
    res.status(404);
    res.send({})
  })
}



logic.isUserAdminOfGroup = isUserAdminOfGroup;
logic.findGroup = findGroup;
module.exports = logic;