// Seed data for CourtCheck - Sample courts and data
const mongoose = require('mongoose');
const Court = require('./models/Court');
const User = require('./models/User');
const CheckIn = require('./models/CheckIn');
const CameraData = require('./models/CameraData');

const sampleCourts = [
    {
        name: "Golden Gate Park Basketball Courts",
        description: "Popular outdoor basketball courts in Golden Gate Park with 4 full courts and good lighting.",
        location: {
            type: "Point",
            coordinates: [-122.4612, 37.7694]
        },
        address: "Golden Gate Park, San Francisco, CA",
        sportType: "basketball",
        amenities: ["lighting", "parking", "restrooms"],
        operatingHours: {
            open: "06:00",
            close: "22:00",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        },
        cameraFeed: {
            url: "rtsp://demo.courtcheck.com/court1",
            type: "rtsp",
            isActive: true
        },
        currentStatus: {
            crowdLevel: 3,
            lastUpdated: new Date(),
            source: "hybrid"
        },
        rating: {
            average: 4.2,
            count: 45
        },
        verified: true
    },
    {
        name: "Mission Dolores Tennis Courts",
        description: "Well-maintained tennis courts with 6 courts available for public use.",
        location: {
            type: "Point",
            coordinates: [-122.4269, 37.7599]
        },
        address: "Mission Dolores Park, San Francisco, CA",
        sportType: "tennis",
        amenities: ["lighting", "parking", "water_fountain", "seating"],
        operatingHours: {
            open: "07:00",
            close: "21:00",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        },
        cameraFeed: {
            url: "rtsp://demo.courtcheck.com/court2",
            type: "rtsp",
            isActive: true
        },
        currentStatus: {
            crowdLevel: 2,
            lastUpdated: new Date(),
            source: "user"
        },
        rating: {
            average: 4.5,
            count: 32
        },
        verified: true
    },
    {
        name: "Presidio Pickleball Courts",
        description: "New pickleball courts with 8 dedicated courts and equipment rental available.",
        location: {
            type: "Point",
            coordinates: [-122.4662, 37.7989]
        },
        address: "Presidio, San Francisco, CA",
        sportType: "pickleball",
        amenities: ["lighting", "parking", "equipment_rental", "seating", "shade"],
        operatingHours: {
            open: "06:00",
            close: "20:00",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        },
        cameraFeed: {
            url: "rtsp://demo.courtcheck.com/court3",
            type: "rtsp",
            isActive: true
        },
        currentStatus: {
            crowdLevel: 4,
            lastUpdated: new Date(),
            source: "ai"
        },
        rating: {
            average: 4.7,
            count: 28
        },
        verified: true
    },
    {
        name: "Balboa Park Soccer Fields",
        description: "Large soccer fields perfect for pickup games and organized matches.",
        location: {
            type: "Point",
            coordinates: [-122.5042, 37.7761]
        },
        address: "Balboa Park, San Francisco, CA",
        sportType: "soccer",
        amenities: ["lighting", "parking", "restrooms", "water_fountain"],
        operatingHours: {
            open: "06:00",
            close: "22:00",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        },
        cameraFeed: {
            url: "rtsp://demo.courtcheck.com/court4",
            type: "rtsp",
            isActive: true
        },
        currentStatus: {
            crowdLevel: 1,
            lastUpdated: new Date(),
            source: "user"
        },
        rating: {
            average: 4.0,
            count: 67
        },
        verified: true
    },
    {
        name: "Marina Green Volleyball Courts",
        description: "Beach volleyball courts with sand surface and ocean views.",
        location: {
            type: "Point",
            coordinates: [-122.4401, 37.8067]
        },
        address: "Marina Green, San Francisco, CA",
        sportType: "volleyball",
        amenities: ["parking", "restrooms", "seating", "shade"],
        operatingHours: {
            open: "06:00",
            close: "20:00",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        },
        cameraFeed: {
            url: "rtsp://demo.courtcheck.com/court5",
            type: "rtsp",
            isActive: false
        },
        currentStatus: {
            crowdLevel: 2,
            lastUpdated: new Date(),
            source: "user"
        },
        rating: {
            average: 4.3,
            count: 23
        },
        verified: false
    },
    {
        name: "Castro Badminton Center",
        description: "Indoor badminton facility with 4 courts and professional equipment.",
        location: {
            type: "Point",
            coordinates: [-122.4350, 37.7611]
        },
        address: "Castro District, San Francisco, CA",
        sportType: "badminton",
        amenities: ["lighting", "parking", "equipment_rental", "restrooms", "seating"],
        operatingHours: {
            open: "08:00",
            close: "22:00",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        },
        cameraFeed: {
            url: "rtsp://demo.courtcheck.com/court6",
            type: "rtsp",
            isActive: true
        },
        currentStatus: {
            crowdLevel: 3,
            lastUpdated: new Date(),
            source: "hybrid"
        },
        rating: {
            average: 4.6,
            count: 19
        },
        verified: true
    }
];

const sampleUsers = [
    {
        name: "Alex Johnson",
        email: "alex.johnson@example.com",
        profilePicture: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
        location: {
            type: "Point",
            coordinates: [-122.4194, 37.7749]
        },
        reputationScore: 150,
        totalCheckIns: 25,
        badges: ["consistent", "helpful", "explorer"]
    },
    {
        name: "Sarah Chen",
        email: "sarah.chen@example.com",
        profilePicture: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
        location: {
            type: "Point",
            coordinates: [-122.4269, 37.7599]
        },
        reputationScore: 200,
        totalCheckIns: 35,
        badges: ["consistent", "helpful", "local_legend"]
    },
    {
        name: "Mike Rodriguez",
        email: "mike.rodriguez@example.com",
        profilePicture: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
        location: {
            type: "Point",
            coordinates: [-122.4612, 37.7694]
        },
        reputationScore: 120,
        totalCheckIns: 18,
        badges: ["early_bird", "explorer"]
    }
];

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');

        // Clear existing data
        await Court.deleteMany({});
        await User.deleteMany({});
        await CheckIn.deleteMany({});
        await CameraData.deleteMany({});

        console.log('Cleared existing data');

        // Create sample courts
        const courts = await Court.insertMany(sampleCourts);
        console.log(`Created ${courts.length} courts`);

        // Create sample users
        const users = await User.insertMany(sampleUsers);
        console.log(`Created ${users.length} users`);

        // Create sample check-ins
        const checkIns = [];
        const now = new Date();
        
        for (let i = 0; i < 50; i++) {
            const court = courts[Math.floor(Math.random() * courts.length)];
            const user = users[Math.floor(Math.random() * users.length)];
            const hoursAgo = Math.floor(Math.random() * 168); // Last week
            const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
            
            checkIns.push({
                user: user._id,
                court: court._id,
                crowdLevel: Math.floor(Math.random() * 5) + 1,
                comment: Math.random() > 0.5 ? getRandomComment() : '',
                weather: {
                    temperature: Math.floor(Math.random() * 20) + 60,
                    condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
                },
                duration: Math.floor(Math.random() * 120) + 30,
                createdAt
            });
        }

        await CheckIn.insertMany(checkIns);
        console.log(`Created ${checkIns.length} check-ins`);

        // Create sample camera data
        const cameraData = [];
        for (let i = 0; i < 100; i++) {
            const court = courts[Math.floor(Math.random() * courts.length)];
            const hoursAgo = Math.floor(Math.random() * 72); // Last 3 days
            const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
            
            const occupancyCount = Math.floor(Math.random() * 20);
            const crowdLevel = Math.min(5, Math.max(1, Math.ceil(occupancyCount / 4)));
            
            cameraData.push({
                court: court._id,
                occupancyCount,
                confidence: 0.7 + Math.random() * 0.3,
                crowdLevel,
                processingTime: Math.floor(Math.random() * 2000) + 500,
                metadata: {
                    weather: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
                    timeOfDay: ['morning', 'afternoon', 'evening', 'night'][Math.floor(Math.random() * 4)],
                    lighting: ['good', 'poor', 'artificial'][Math.floor(Math.random() * 3)]
                },
                createdAt
            });
        }

        await CameraData.insertMany(cameraData);
        console.log(`Created ${cameraData.length} camera data records`);

        console.log('Database seeding completed successfully!');
        console.log('\nSample data created:');
        console.log(`- ${courts.length} courts`);
        console.log(`- ${users.length} users`);
        console.log(`- ${checkIns.length} check-ins`);
        console.log(`- ${cameraData.length} camera data records`);

    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

function getRandomComment() {
    const comments = [
        "Great court, well maintained!",
        "Pretty busy today but worth the wait",
        "Perfect weather for playing",
        "Court is in good condition",
        "Had a great game here",
        "Lighting is excellent for evening games",
        "Parking was easy to find",
        "Court surface is smooth",
        "Good crowd today",
        "Will definitely come back"
    ];
    return comments[Math.floor(Math.random() * comments.length)];
}

// Run seeding if this file is executed directly
if (require.main === module) {
    require('dotenv').config();
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/courtcheck', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }).then(() => {
        console.log('Connected to MongoDB');
        return seedDatabase();
    }).then(() => {
        console.log('Seeding completed');
        process.exit(0);
    }).catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = { seedDatabase, sampleCourts, sampleUsers };

