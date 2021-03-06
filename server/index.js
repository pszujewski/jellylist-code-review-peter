const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { BasicStrategy } = require('passport-http');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
require('dotenv').config();

const { PORT, DATABASE_URL } = require('./config');

const { User } = require('./models');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

mongoose.Promise = global.Promise;

// API endpoints go here!
app.get('/api/users', (req, res) => {
  User 
    .find()
    .exec()
    .then(users => {
      console.log('->', users);
      res.json(users.map(user => user.apiRepr()))
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({error: 'Internal server error'});
    });
})

app.get('/api/users/:id', (req, res) => {
  User 
    .findById(req.params.id)
    .exec()
    .then(user => {
      if (!user) {
        return res.status(400).send();
      }
      res.json(user.apiRepr())
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({error: 'Internal server error'});
    });
})

app.get('/api/users/:id/:index', (req, res) => {
  User 
    .findById(req.params.id)
    .exec()
    .then(index => {
      console.log(index)
      console.log(req.params.index)
      if (!index) {
        return res.status(400).send();
      }
      return res.send(index.giftlist[req.params.index])
      index.giftlist[req.params.index] = req.body.something
      index.save(function(err ){
        return res.send(index.giftlist[req.params.index])
        // or it fails
      })
    })
})

app.post('/api/users', (req, res) => {
  console.log(req.body)
  User
    .create({
      user: req.body.user,
      email: req.body.email,
      password: req.body.password,
      birthday: req.body.birthday,
      giftlist: req.body.giftlist // Instead of pulling off an empty array from the req body, mabe just initialize the new document with an empty array?
    })
    .then(user => {
       console.log(user)
       res.status(201).json(user.apiRepr())
    })
    .catch(err => {
      console.log(err)
      res.status(500).json({message: 'Internal server error'})
    })
})

app.patch('/api/users/:id/add', (req, res) => {
  console.log(req.body)
  User
    .findByIdAndUpdate(req.params.id, {$push: {giftlist: {name: req.body.name, purchased: false}}}, {new: true})
    .then(updatedUser => res.status(201).json(updatedUser.apiRepr()))
    .catch(err => res.status(500).json({message: 'internal server error'}))
})

app.patch('/api/users/:id/:index', (req, res) => {
  User 
    .findById(req.params.id)
    .exec()
    .then(index => {
      if (!index) {
        return res.status(400).send();
      }
      // req.body.something = index.giftlist[req.params.index] 
      // It looks like .save is a method on the model (in your case, User) and not any retrieved documents
      // It is for saving a new instance of the model in the database: http://mongoosejs.com/docs/models.html
      // Maybe you don't mean to use this endpoint any more?
      index.save(function(err){
        if(err) return res.status(500).send()
        console.log(req.body.something)
        return res.send(index.giftlist[req.params.index])
      })
    })
})


app.delete('/api/users/:id', (req, res) => {
  User
    .findByIdAndRemove(req.params.id)
    .exec()
    .then(()=> {
      res.status(204).json({message: 'success'})
    })
    .catch(err => {
      console.log(err)
      res.status(500).json({error: 'internal server error'})
    })
})

app.put('/api/users/:id', (req, res) => {
  // Using $set to update giftlist works for sure but I'm assuming you want to use this endpoint
  // to delete items from giftlist. Instead of replacing whole array each time, you could use:
  // ------
  // .findByIdAndUpdate(
  //    req.params.id,
  //    { $pull: { giftlist: { _id: itemId } } },
  //    {safe: true}
	// 	).exec()
  // -------
  // This would remove the one selected item with the given id, for example

  const updated = {};
  const updateableFields = ['user', 'email', 'giftlist', 'birthday'];
  updateableFields.forEach(field => {
    if (field in req.body) {
      updated[field] = req.body[field]
    }
  })
  User
    .findByIdAndUpdate(req.params.id, {$set: updated}, {new: true})
    .exec()
    .then(updatedUser => res.status(201).json(updatedUser.apiRepr()))
    .catch(err => res.status(500).json({message: 'internal server error'}))
})


// Serve the built client
app.use(express.static(path.resolve(__dirname, '../client/build')));

// Unhandled requests which aren't for the API should serve index.html so
// client-side routing using browserHistory can function
app.get(/^(?!\/api(\/|$))/, (req, res) => {
  const index = path.resolve(__dirname, '../client/build', 'index.html');
  res.sendFile(index);
});

let server;
function runServer(port = PORT, databaseUrl=DATABASE_URL) {
  console.log(databaseUrl);
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
      .on('error', err => {
        mongoose.disconnect();
        reject(err);
      });
    });  
  });
}

function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  })
}

if (require.main === module) {
  runServer();
}

module.exports = {
  app, runServer, closeServer
};
