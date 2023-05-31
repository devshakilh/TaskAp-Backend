const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.w0pu2sb.mongodb.net/?retryWrites=true&w=majority`;


// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.twtll.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const appointmentOptionCollection = client.db('App').collection('appointmentOptions');
        const bookingsCollection = client.db('App').collection('bookings');
        const usersCollection = client.db('App').collection('users');



        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;

            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access.' });
            }
            next();
        };

        // Verify is the user Seller
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;

            const query = { email: decodedEmail };
            const user = await UsersCollection.findOne(query);
            if (user.role !== 'seller') {
                return res.status(403).send({ message: 'Forbidden Access.' });
            }
            next();
        };


        // Verify is the user Buyer
        const verifyBuyer = async (req, res, next) => {
            const decodedEmail = req.decoded.email;

            const query = { email: decodedEmail };
            const user = await UsersCollection.findOne(query);
            if (user.role !== 'buyer') {
                return res.status(403).send({ message: 'Forbidden Access.' });
            }
            next();
        };


        // Use Aggregate to query multiple collection and then merge data
        app.get('/appointmentOptions', async (req, res) => {

            // const query = {};
            // const options = await appointmentOptionCollection.find(query).toArray();

            const date = req.query.date;
            const query = {};
            const options = await appointmentOptionCollection.find(query).toArray();

            // get the bookings of the provided date
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            // code carefully :D
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
            })
            res.send(options);
        });

        app.get('/v2/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const options = await appointmentOptionCollection.aggregate([
                {
                    $lookup: {
                        from: 'bookings',
                        localField: 'name',
                        foreignField: 'treatment',
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$appointmentDate', date]
                                    }
                                }
                            }
                        ],
                        as: 'booked'
                    }
                },
                {
                    $project: {
                        name: 1,
                        slots: 1,
                        booked: {
                            $map: {
                                input: '$booked',
                                as: 'book',
                                in: '$$book.slot'
                            }
                        }
                    }
                },
                {
                    $project: {
                        name: 1,
                        slots: {
                            $setDifference: ['$slots', '$booked']
                        }
                    }
                }
            ]).toArray();
            res.send(options);
        })

        // app.post('/bookings', async (req, res) => {
        //     const booking = req.body
        //     const result = await bookingsCollection.insertOne(booking);
        //     res.send(result);
        // })
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray();

            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.appointmentDate}`
                return res.send({ acknowledged: false, message })
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
        // Get All Seller
        app.get('/users/allSeller', verifyAdmin, async (req, res) => {
            const query = { role: 'seller' };
            const users = await UsersCollection.find(query).toArray();
            res.send(users);
        });

        // Get All Buyer
        app.get('/users/allBuyer', verifyAdmin, async (req, res) => {
            const query = { role: 'buyer' };
            const users = await UsersCollection.find(query).toArray();
            res.send(users);
        });

        // app.put('/users/admin/:id', async (req, res) => {
        //     const decodeEmail = req.decoded.email;
        //     const query = { email: decodeEmail };
        //     if (user?.role !== 'admin') {
        //         return res.status(403).send({ message: 'forbidden access' })
        //     }


        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) }
        //     const options = { upsert: true };
        //     const updateDoc = {
        //         $set: {
        //             role: 'admin'
        //         }
        //     }
        //     const result = await usersCollection.updateOne(filter, updateDoc, options);
        //     res.send(result);

        // })



        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        });

        // Check Whether a user is Seller or not.
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await UsersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        });

        // Check Whether a user is Buyer or not.
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        });


    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('doctors portal server is running');
})

app.listen(port, () => console.log(`Doctors portal running on ${port}`))