process.env.NODE_ENV = 'dev'
const config = require('config')
const Account = require('../models/account');
const Group = require('../models/group');
const Mache = require('../models/mache');
const Folio = require('../models/folio');
const Clipping = require('../models/clipping');
const Element = require('../models/element');
const Role = require('../models/role');


const uniq = (a) => Array.from(new Set(a));
const getMaches = (macheIds) => Mache.find({ _id : { $in : macheIds } }).populate({ path : 'elements' , populate : { path : 'clipping' } }).exec()

const extractElements = (maches) => {
  if ( !Array.isArray(maches) ) { maches = [maches] }
  const elements = maches.map( mache => mache.elements).reduce( (a,b) => a.concat(b) )
  return elements
}

//Fix seed
const extractClippings = (maches) => {
  if ( !Array.isArray(maches) ) { maches = [maches] }
  // let clippingIds = maches.map( mache => mache.elements.map( element => element.clipping ) ).reduce( (a,b) => a.concat(b) ).filter( clipping => clipping !== null ).map( c => c._id )
  // return Clipping.find({ _id : { $in : clippingIds } }).exec()
  return maches.map( mache => mache.elements.map( element => element.clipping ) ).reduce( (a,b) => a.concat(b) ).filter( clipping => clipping !== null )
}

const extractMaches = async (collection, options) => {
  if ( !Array.isArray(collection) ) { collection = [collection] }
  const modelName = collection[0].constructor.modelName;
  let maches = []

  const extractMaches_folio = (folios) => {
    if ( !folios ) { folios = collection }
    const macheIds = folios.map( (folio) => folio.macheSubmissions.map( sub => sub.mache.toString() ) ).reduce( (a, b) => a.concat(b) )
    return getMaches(macheIds)
  }
  const extractMaches_group = async () => {
    const folioIds = collection.map( (group) => group.folios ).reduce( (a, b) => a.concat(b) )
    const folios = await Folio.find({ _id : { $in : folioIds } }).select('macheSubmissions').exec()
    return extractMaches_folio(folios);
  }
  const extractMaches_user = async () => {
    const macheIds = collection.map( (user) => user.maches ).reduce( (a, b) => a.concat(b) )
    return getMaches(macheIds)
  }

  if ( modelName === 'Folio' ) {
    maches = await extractMaches_folio()
  } else if ( modelName === 'Group' ) {
    maches = await extractMaches_group()
  } else if ( modelName === 'Account') {
    maches = await extractMaches_user();
  } else {
    console.log(`Model ${modelName} is not supported`)
  }
  return maches;
}


module.exports = {
  extractMaches : extractMaches,
  extractElements : extractElements,
  extractClippings : extractClippings
}