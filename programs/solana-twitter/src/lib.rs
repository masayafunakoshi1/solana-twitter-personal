use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("8GNkUvrrk8b2qgVxfaB7QHPgiA7qgzGer4jaoZ2fqUyn");

#[program]
pub mod solana_twitter {
    use super::*;
    //working instruction that initialises a new Tweet account with information
    pub fn send_tweet(ctx: Context<SendTweet>, topic: String, content: String) -> ProgramResult {
        //Tweet account that's already initialised (init) 
            //& = access account by reference 
            //mut = make it mutable
        let tweet: &mut Account<Tweet> = &mut ctx.accounts.tweet;
        //Get author account to save it on tweet account
        let author: &Signer = &ctx.accounts.author;
        //Solana clock to get timestamp
        let clock: Clock = Clock::get().unwrap(); 
        //Clock::get() returns Result (Ok or Err), unwrapping gets data if Ok or immediately returns error

        //CHECKS before hydrating tweet account
        if topic.chars().count() > 50 {
            //Return an error
            return Err(ErrorCode::TopicTooLong.into()) 
            //access error type as a const (::), wrap it inside the Err enum type
        }
        if content.chars().count() > 280{
            //Return an error
            return Err(ErrorCode::ContentTooLong.into())
        }
        //If we want to make sure no empty topics or content
        // if topic.chars().count() <= 0 {
        //     //Return an error
        //     return Err(ErrorCode::TopicTooShort.into()) 
        // }
        // if content.chars().count() <= 0{
        //     //Return an error
        //     return Err(ErrorCode::ContentTooShort.into())
        // }

        //referencing Tweet account through "let tweet" and adding information
        tweet.author = *author.key;
        tweet.timestamp = clock.unix_timestamp;
        tweet.topic = topic;
        tweet.content = content;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SendTweet <'info> {
    #[account(init, payer = author, space = Tweet::LEN)] //defines who pays and space needed for tweet account
    pub tweet: Account<'info, Tweet>,
    #[account(mut)]  //makes author mutable, changes amount of money to pay for rent
    pub author: Signer<'info>,
    #[account(address = system_program::ID)] //makes sure it's official Solana system_program
    pub system_program: AccountInfo<'info>
}

#[account] //Custom Rust attribute provided by Anchor
pub struct Tweet {  //Rust struct (think of them as classes that only describe props)
    //Owner of an account will be the program that generated it
    pub author: Pubkey, //user who published tweet
    pub timestamp: i64, //keep track of time
    pub topic: String,  //Twitter's hashtag, grouping topics
    pub content: String,//actual content of tweet
}

#[error]
pub enum ErrorCode {
    #[msg("The provided topic should be 50 characters long maximum.")] //Rust error msg
    TopicTooLong, //name of error
    #[msg("The provided content should be 280 characters long maximum.")]
    ContentTooLong,
    //If we want to make sure no empty topics or content
    // #[msg("The provided topic should be ATLEAST 1 characters long minimum.")] //Rust error msg
    // TopicTooShort, //name of error
    // #[msg("The provided content should be ATLEAST 1 characters long minimum.")]
    // ContentTooShort,
}



//Whenever a new account is created, a discriminator of exactly 8 bytes will be added to the very beginning of the data.
const DISCRIMINATOR_LENGTH: usize = 8;

//pub struct Pubkey([u8; 32]);
//struct defines an array of 32 items of type u8. The type u8 means it’s an unsigned integer of 8 bits. Since there are 8 bits in one byte, we end up with a total array length of 32 bytes.
const PUBLIC_KEY_LENGTH: usize = 32;

//The timestamp property is of type i64. That means it’s an integer of 64 bits or 8 bytes.
const TIMESTAMP_LENGTH: usize = 8;

//pub struct String {vec: Vec<u8>,} vector containing elements of 1 byte (u8)
//Vector = array whos total length is unknown
//Decision: Topic has a max size of 50 characters
//UTF-8, each character can have a max size of 4 bytes
//50 * 4 = 200 bytes (maximum)
const MAX_TOPIC_LENGTH: usize = 50 * 4; 
//Strings also havea 4 bytes prefix to store TOTAL LENGTH
const STRING_LENGTH_PREFIX: usize = 4;

//Decision: Content has max size of 280 characters
//4 + 280 * 4 = 1124 bytes
const MAX_CONTENT_LENGTH: usize = 280 * 4;

impl Tweet {
    const LEN: usize = DISCRIMINATOR_LENGTH
    + PUBLIC_KEY_LENGTH //Author
    + TIMESTAMP_LENGTH  //Timestamp
    + STRING_LENGTH_PREFIX + MAX_TOPIC_LENGTH   //Topic
    + STRING_LENGTH_PREFIX + MAX_CONTENT_LENGTH;//Content
}