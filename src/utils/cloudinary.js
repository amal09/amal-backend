import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if(!localFilePath)  return null;
    // else upload
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto"
    });
    fs.unlinkSync(localFilePath);
    return response;    //return the object, console log to find more about it
  }
  catch(error){
    //we need to  remove the locally saved temporary file as the upload failed
    fs.unlinkSync(localFilePath);  
    return null;
  }
};


export {uploadOnCloudinary}
