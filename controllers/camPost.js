const formidable = require('formidable');
const admin = require('firebase-admin');
const prisma = require('../database/prisma.js');
const path = require('path');
const fs = require('fs');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "creat-5d81c.appspot.com" // Replace with your actual bucket name
});

const bucket = admin.storage().bucket();

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Method to create a new camping post
const createPost = async (req, res) => {
  const form = new formidable.IncomingForm({
    uploadDir: uploadDir, // Directory to store uploaded files temporarily
    keepExtensions: true, // Keep file extensions
  });
  form.parse(req, async (err, fields, files) => {
    console.log(files, 'eeeeeeeeeeeee');
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    console.log(fields, files)
    const defaultImgs={
      Hiking:'https://firebasestorage.googleapis.com/v0/b/creat-5d81c.appspot.com/o/hiking.jpg?alt=media&token=90f6a6c5-1211-440d-b3e3-723b026ebbe9',
      Kayaking:'https://firebasestorage.googleapis.com/v0/b/creat-5d81c.appspot.com/o/kayaking.jpg?alt=media&token=68ee81ad-b572-45a6-8978-21d1a0d41527',
      Fishing:'https://firebasestorage.googleapis.com/v0/b/creat-5d81c.appspot.com/o/images.jpg?alt=media&token=83122bc7-fe21-45c5-83e0-2efb5e2bfcab',
      Climbing:'https://firebasestorage.googleapis.com/v0/b/creat-5d81c.appspot.com/o/images%20(1).jpg?alt=media&token=00b3166d-0d61-4c93-96a0-808311e742bf',
      Hitchhiking:'https://firebasestorage.googleapis.com/v0/b/creat-5d81c.appspot.com/o/hitchhiking.jpg?alt=media&token=4334ea6e-06b4-451b-8a4e-274cd971ac72'
    }
    const { organizerId, title, description, location, startDate, endDate, equipment, places, ageCategory, category, status } = fields;
    try {
      let imageUrls = [];
      // if files.images is undefined => based on the category fill the imageUrls array with default image urls
      // Access the files from the files object
      // const fileArray = Array.isArray(files.images) ? files.images : [files.images]; // Handle single or multiple files
      // Extract the rest of the fields
      const fileArray = files.images
      if (fileArray && fileArray.length > 0) {

        // Process each image and get their URLs
        imageUrls = await Promise.all(fileArray.map(async (file) => {
          const filePath = file.filepath; // Path to the temporary file
          const timestamp = Date.now(); // Optional: for unique file names
          const remoteFilePath = `uploads/images/${timestamp}-${file.originalFilename}`;

          // Upload the image using the bucket.upload() function
          await bucket.upload(filePath, { destination: remoteFilePath });

          // Options for the getSignedUrl() function
          const options = {
            action: 'read',
            expires: Date.now() + 24 * 60 * 60 * 1000 // 1 day
          };

          // Generate a signed URL for the uploaded file
          const [signedUrl] = await bucket.file(remoteFilePath).getSignedUrl(options);
          return signedUrl; // Return the signed URL
        }))
      } else {
        if (category === 'Hiking') {
          imageUrls.push(defaultImgs.Hiking)
        } if (category === 'Kayaking') {
          imageUrls.push(defaultImgs.Kayaking)
        } if (category === 'Fishing') {
          imageUrls.push(defaultImgs.Fishing)
        } if (category === 'Climbing') {
          imageUrls.push(defaultImgs.Climbing)
        } if (category === 'Hitchhiking') {
          imageUrls.push(defaultImgs.Hitchhiking)
        }
      }
console.log(imageUrls,'iiiiiiiii',defaultImgs,'eeeeee',category,'rrrr');

      // Create the new camping post with the image URLs
      const newPost = await prisma.campingPost.create({
        data: {
          organizerId: Number(organizerId),
          title: Array.isArray(title) ? title[0] : title,
          description: Array.isArray(description) ? description[0] : description,
          location: Array.isArray(location) ? location[0] : location,
          startDate: new Date(Array.isArray(startDate) ? startDate[0] : startDate),
          endDate: new Date(Array.isArray(endDate) ? endDate[0] : endDate),
          equipment,
          places: Number(places),
          ageCategory: Array.isArray(ageCategory) ? ageCategory[0] : ageCategory,
          category: Array.isArray(category) ? category[0] : category,
          status: Array.isArray(status) ? status[0] : status,
          images: imageUrls, // Store the array of image URLs
        },
      });

      return res.json({ status: 200, data: newPost, msg: "Post created." });
    } catch (uploadError) {
      console.error(uploadError);
      res.status(500).json({ success: false, error: uploadError.message });
    }
  });
};

const campingPostDetails = async (req, res) => {
  const { id } = req.params; // Retrieve the ID from the request parameters

  try {
    // Fetch a single CampingPost entry by its ID
    const campingPost = await prisma.campingPost.findUnique({
      where: {
        id: parseInt(id, 10) // Convert ID to integer
      },
      include: {
        user: true,
        joinCampingPosts: {
          include: {
            user: true // Optionally include user details in joinCampingPosts
          }
        }
      }
    });

    if (!campingPost) {
      return res.status(404).json({ status: 404, message: 'CampingPost not found' });
    }

    return res.json({ status: 200, data: campingPost });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};

const onePostParticipants = async (req, res) => {
  const { id } = req.params; // Retrieve the ID from the request parameters

  try {
    // Fetch a single CampingPost entry by its ID
    const campingPost = await prisma.campingPost.findUnique({
      where: {
        id: parseInt(id, 10) // Convert ID to integer
      },
      include: {
        user: true,
        joinCampingPosts: {
          include: {
            user: true, // Optionally include user details in joinCampingPosts
            post: true
          }
        }
      }
    });

    if (!campingPost) {
      return res.status(404).json({ status: 404, message: 'CampingPost not found' });
    }

    return res.json({ status: 200, data: campingPost });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};
/////////////////////////////////////////////////////////   Create Review and Ratings


const updateReview = async (req, res) => {
  const { postId, userId, rating, reviews } = req.body;

  // Validate the input
  if (typeof rating !== 'number' || typeof reviews !== 'string' || !postId || !userId) {
    return res.status(400).json({ status: 400, message: 'Invalid input' });
  }

  try {
    // Fetch the camping post
    const campingPost = await prisma.campingPost.findUnique({
      where: {
        id: Number(postId),
      },
      select: {
        status: true, // Get the status of the camping post
        joinCampingPosts: {
          where: {
            userId: Number(userId)
          },
          select: {
            status: true // Get the user's status in relation to the camping post
          }
        }
      }
    });

    if (!campingPost) {
      return res.status(404).json({ status: 404, message: 'CampingPost not found' });
    }

    // Check if the camping post status is 'Completed'
    if (campingPost.status !== 'Completed') {
      return res.status(400).json({ status: 400, message: 'Trip is not completed so you cant review or rate yet' });
    }

    // Check if the user status is 'ACCEPTED'
    const userStatus = campingPost.joinCampingPosts.length > 0 ? campingPost.joinCampingPosts[0].status : null;
    if (userStatus !== 'ACCEPTED') {
      return res.status(400).json({ status: 400, message: 'You are not accepted to join this trip so you are not allowed to  review or rate the trip' });
    }

    // Update the review in the JoinCampingPost table
    const updatedJoin = await prisma.joinCampingPost.update({
      where: {
        userId_postId: {
          userId: Number(userId),
          postId: Number(postId),
        },
      },
      data: {
        rating,
        reviews,
      },
    });

    // Return a success response
    return res.json({ status: 200, data: updatedJoin, msg: "Review updated successfully." });
  } catch (error) {
    // Log and return the error
    console.error('Error updating review:', error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};

////////////////////////////////////////////////////////////////////////////////


const fetchCampings = async (req, res) => {
  const campings = await prisma.campingPost.findMany({
    include: {
      user: true,
      joinCampingPosts: {
        include: {
          post: true, // To include the associated CampingPost
          user: true
        }
      },
    },
    orderBy: {
      id: "desc",
    },
  });
  return res.json({ status: 200, data: campings });
};
//////////////////////////////////////////////////

const fetchUserCampings = async (req, res) => {
  const { userId } = req.params;

  try {
      // Fetch all camping posts created by the user
      const userCampings = await prisma.campingPost.findMany({
          where: {
              organizerId: parseInt(userId, 10)
          },
          include: {
              user: true, // Include user details
              joinCampingPosts: {
                  include: {
                      user: true // Include users who joined the camping posts
                  }
              }
          },
          orderBy: {
              id: "desc"
          }
      });

      if (!userCampings) {
          return res.status(404).json({ status: 404, message: 'No camping posts found for this user' });
      }

      return res.json({ status: 200, data: userCampings });
  } catch (error) {
      console.error('Error fetching user campings:', error);
      return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};

module.exports = {
    fetchCampings,
    createPost,
    campingPostDetails,
    onePostParticipants,
    updateReview,
    fetchUserCampings
}
