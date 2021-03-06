'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db.js');
const ObjectId = require('mongodb').ObjectId;
const app = express();
const session = require('express-session');
const url = require('url');
const request = require('request');
const _ = require('lodash');

const APP_PATH = path.join(__dirname, 'dist');

var collections;

app.set('port', (process.env.PORT || 3000));

app.use('/', express.static(APP_PATH));
app.use('/', express.static(path.join(__dirname, 'static')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(function(req, res, next) {
    res.setHeader('Cache-Control', 'no-cache');
    next();
});

/* Server for Media React
 * This uses google login for handling users and MongoDB for the database   
 * see db.js for how the dataBase is set up.
*/

// Check authorization of user for doing certian things
const authorizedTo = function (role) {
    return function (req, res, next) {
        let userPromise = Promise.resolve(null);
        if (req.session.mediaReactUserId) {
            userPromise = collections.user.findOne({_id: ObjectId(req.session.mediaReactUserId)}).then((user) => {
                //console.log(user)
                if (!user) {
                    req.session.mediaReactUserId = null;
                }
                return user;
            });
        }
        userPromise.then((user) => {
            if (user) {
                next();
            } else {
                res.status(403).end();
            }
        }).catch(next);
    };
};

// login using google Oauth.
app.post('/api/login', function(req, res) {
    const googleTemplate = url.parse('https://www.googleapis.com/oauth2/v3/tokeninfo', true);
    googleTemplate.query.id_token = req.body.id_token;
    request({url:url.format(googleTemplate), json:true}, (error, response, body) => {
        if (!error && response.statusCode == 200 && body.email_verified) {
            // use recursion for logging in / make new account
            const findOrCreateUserByEmail = function () {
                return collections.user.findOne({email: body.email}).then((user) => {
                    if  (user) {
                        return user;
                    } else {
                        return collections.user.insertOne({
                            email: body.email,
                        }).then(() => {
                            return findOrCreateUserByEmail();
                        });
                    }
                });
            }
            findOrCreateUserByEmail().then((user) => {
                //console.log(`${body.email}: found userId=${user._id}`);
                req.session.mediaReactUserId = String(user._id);
                res.json({userId: user._id});

                // TODO: update profile pic
                collections.user.update({_id: user._id}, {$set: {avatarUrl: body.picture, name: body.name}});
            }).catch((ex) => {
                console.error(ex);
                res.status(500).end();
            });
        } else {
            res.status(500).end();
        }
    });
});

// Logout
// 500 error if failed to logout
app.post('/api/logout', function(req, res) {
    if (req.session.mediaReactUserId) {
        req.session.mediaReactUserId = null;
        res.json({});
    } else {
        res.status(500).end();
    }
});

// get all of the posts
// if userFilter then filter it out by the user
app.get('/api/posts', function(req, res, next) {
    if (!req.query.userFilter) {
        getPostCollection(req, res).catch(next);
    } else {
        getUserPostCollection(req, res, req.query.userFilter).catch(next);
    }
});

// get all catalogs
app.get('/api/catalog', function(req, res, next) {
    getCatalogCollection(res).catch(next);
});

// get a specific type of catalog
app.get('/api/catalog/:catalog', function(req, res, next) {
    var catalog = req.params.catalog;
    getCatalogCollectionType(res, catalog).catch(next);
});

// post new thing to catalog
app.post('/api/catalog', authorizedTo(), function(req, res, next) {
    // Check if logged in
    if (!req.session.mediaReactUserId) {
        return res.status(403).json({});
    }
    var newCatalog = {
        catalog: req.body.catalog,
        title: req.body.title,
        author: req.body.author,
        year: req.body.year,
        userId: ObjectId(req.session.mediaReactUserId),
        date: new Date(),
    };
    collections.catalog.insertOne(newCatalog).then((result) => {
        return getCatalogCollection(res);
    }).catch(next);
});

// delete thing in catalog
// returns a 403 if nothing was deleted
app.delete('/api/catalog/:id', authorizedTo(), function(req, res, next) {
    collections.catalog.deleteOne(
        {'_id': ObjectId(req.params.id)}).then((result) => {
            if (result.deletedCount == 0) {
                res.status(403).end();
                return;
            }
            return getCatalogCollection(res);
        }).catch(next);
});

// post to the post collection. This also handles if someone is posting a link or not
app.post('/api/posts', authorizedTo(), function(req, res, next) {
    var newPost = {
        type: req.body.type,
        date: new Date(),
        title: req.body.title,
        text: req.body.text,
        userId: ObjectId(req.session.mediaReactUserId),
    };
    if (newPost.type == "url") {
        // Todo validate url
        newPost.url = req.body.url;
    }
    collections.post.insertOne(newPost).then((result) => {
        return getPostCollection(req, res);
    }).catch(next);
});

// get a certain post
app.get('/api/posts/:id', function(req, res, next) {
    console.log('getting the post for ye');
    getPost(req.params.id, res).catch(next);
});

// change a post
app.put('/api/posts/:id', authorizedTo(), function(req, res, next) {
    // Make this throw a 403
    var updateId = ObjectId(req.params.id);
    var update = req.body;
    collections.post.updateOne(
        { _id: updateId, userId: ObjectId(req.session.mediaReactUserId) },
        { $set: update }).then((result) => {
            return getPostCollection(req, res);
        }).catch(next);
});

// delete a specific post
app.delete('/api/posts/:id', authorizedTo(), function(req, res, next) {
    collections.post.deleteOne(
        {'_id': ObjectId(req.params.id), userId: ObjectId(req.session.mediaReactUserId)}).then((result) => {
            if (result.deletedCount == 0) {
                res.status(403).end();
                return;
            }
            return getPostCollection(req, res);
        }).catch(next);
});

// for posting comments
app.post('/api/comments', authorizedTo(), function(req, res, next) {
    collections.post.findOne({_id: ObjectId(req.body.postId)}).then((post) => {
        if (!post) {
            throw new Error("post does not exist");
        }
        collections.comment.findOne({'_id': ObjectId(req.body.parentCommentId)}).then((parentComment) => {
            const parentCommentId = parentComment ? parentComment._id : null;
            var newComment = {
                date: new Date(),
                text: req.body.text,
                userId: ObjectId(req.session.mediaReactUserId),
                postId: post._id,
                parentCommentId: parentCommentId,
                ancestorCommentIds: parentComment ? _.take([parentCommentId].concat(parentComment.ancestorCommentIds), 20) : [],
            };
            return collections.comment.insertOne(newComment).then((result) => {
                return getPost(newComment.postId, res);
            });
        })
    }).catch(next);
});

// Send all routes/methods not specified above to the app root.
app.use('*', express.static(APP_PATH));

// once the db is made make run the server
db.then((dbThings) => {
    collections = dbThings.collections;
    console.log("DB resolved");
    const outerApp = express();

    // Sessions
    outerApp.use(session({
      secret: 'keyboard cat',
      resave: false,
      saveUninitialized: false,
      store: dbThings.sessionStore
    }));

    // attach outerApp to app
    outerApp.use(app);

    // listen on port
    outerApp.listen(app.get('port'), function() {
        console.log('Server started: http://localhost:' + app.get('port') + '/');
    });
});

// get post and comments with users attached to the comments
var getPost = function (postId, res) {
    // Todo add this to more things to make reduce change of DOS
    if (typeof postId !== 'string' && !(postId instanceof ObjectId)) {
         throw new Error(`postId: ${postId} is not valid.`)
    }
    return collections.post.findOne({_id:  ObjectId(postId)}).then((post) => {
        // add user to docs
        console.log(post);
        if (!post) {
            throw new Error(`post ${postId} does not exist`);
        }
        return collections.comment.find({postId: post._id}, {sort: {date : -1 }}).toArray().then((comments) => {
            const commentById = _.keyBy(comments, "_id");
            // Make sure everything has a comments key
            for (let comment of comments) {
                comment.comments = [];
            }
            // attach the comments to each other.
            post.comments = [];
            for (let comment of comments) {
                if (comment.parentCommentId) {
                    // find the parents then add it to parent then make them combine.
                    commentById[comment.parentCommentId].comments.push(comment);
                } else {
                    // attach to array of top level comments
                    post.comments.push(comment);
                }
            }
            // expand everything to users
            return buildUsersFromIds(comments.concat(post));
        }).then(() => {
            res.json(post);
        });
    })
}

// get all posts sorted by date
var getPostCollection = function (req, res) {
    // http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#find
    // Making this get user id and email
    return collections.post.find({}, {sort: { date : -1 }}).toArray().then((posts) => {
        //console.log(docs);
        return buildUsersFromIds(posts);
    }).then(posts => {
        res.json(posts);
    });
}

// get all posts of a certain user
var getUserPostCollection = function (req, res, userId) {
    // http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#find
    // Making this get user id and email
    return collections.post.find({userId: ObjectId(userId)}, {sort: { date : -1 }}).toArray().then((posts) => {
        //console.log(docs);
        return buildUsersFromIds(posts);
    }).then(posts => {
        res.json(posts);
    });
}

// get catalog collection sorted by date
var getCatalogCollection = function (res) {
    return collections.catalog.find({}, {sort: { date : -1 }}).toArray().then((docs) => {
        //console.log(docs);
        res.json(docs);
    });
}

//Gets data based on type variable
var getCatalogCollectionType = function (res, catalog) {
    return collections.catalog.find({catalog: catalog}, {sort: { title : 1 }}).toArray().then((docs) => {
        //console.log(docs);
        res.json(docs);
    });
}

// function for returning only parts of users information so the server does not leak important information about the user
var userAsPublic = function (user) {
    return _.pick(user, ['_id', 'avatarUrl', 'name']);
}

// Thing has userIds. They want to be displayed as public users.
var buildUsersFromIds = function (things) {
    // http://stackoverflow.com/a/28069092
    var uniqueUserIds = _(things).map((thing) => String(thing.userId)).uniq().map((idString) => ObjectId(idString)).value();
    return collections.user.find( { _id: { $in: uniqueUserIds}}).toArray().then((users) => {
        users = _.keyBy(users, "_id");
        _.forEach(things, (thing) => {
            thing.user = users[thing.userId];
            //post.myPost = (post.userId == req.session.mediaReactUserId);
            thing.user = userAsPublic(thing.user);
        });
        return things;
    });
}
