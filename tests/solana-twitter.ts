import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SolanaTwitter } from '../target/types/solana_twitter';
//adding assertions
import * as assert from "assert"
import * as bs58 from "bs58";

describe('solana-twitter', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());
  const program = anchor.workspace.SolanaTwitter as Program<SolanaTwitter>;

  //overall test
  it('can send a new tweet', async () => {
    //generate new key/pair
    const tweet = anchor.web3.Keypair.generate();
    //Before sending the transaction to the blockchain.
    await program.rpc.sendTweet('veganism', 'Hummus, am I right?', {
      accounts: {
        //Accounts here...
        tweet: tweet.publicKey,
        author: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [
        //Key pairs of signers here...
        tweet
      ],
    });
    //After sending the transaction to the blockchain

    //Fetch the account details of the created tweet
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    
    //Ensure it has the right data
    assert.equal(tweetAccount.author.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'veganism');
    assert.equal(tweetAccount.content, 'Hummus, am I right?');
    assert.ok(tweetAccount.timestamp)
  });

  //second testing scenario

  it('can send a new tweet without a topic', async () => {
    //Call the "SendTweet" instruction
    const tweet = anchor.web3.Keypair.generate();
    await program.rpc.sendTweet('', 'gm', {
      accounts: {
        //Accounts here...
        tweet: tweet.publicKey,
        author: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [
        tweet
      ],
    });

    //Fetch the account details of the created tweet
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    
    //Ensure it has the right data
    assert.equal(tweetAccount.author.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.equal(tweetAccount.topic, '');
    assert.equal(tweetAccount.content, 'gm');
    assert.ok(tweetAccount.timestamp)
  });


  //third testing scenario

  it('can send a new tweet from a different author', async () => {
    //Generate another user and airdrop them some SOL
    const otherUser = anchor.web3.Keypair.generate();
    //send 1 SOL (1,000,000,000 Lamports) to otherUser
    const signature = await program.provider.connection.requestAirdrop(otherUser.publicKey, 1000000000)
    //wait until money is transferred to their account
    await program.provider.connection.confirmTransaction(signature)

    //Call the "SendTweet" instruction on behalf of this other user
    const tweet = anchor.web3.Keypair.generate();
    await program.rpc.sendTweet('veganism', 'Yay Tofu!', {
      accounts: {
        tweet: tweet.publicKey,
        author: otherUser.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [
        otherUser,
        tweet
      ],
    });


    //Fetch the account details of the created tweet
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    
    //Ensure it has the right data
    assert.equal(tweetAccount.author.toBase58(), otherUser.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'veganism');
    assert.equal(tweetAccount.content, 'Yay Tofu!');
    assert.ok(tweetAccount.timestamp)
  });


  //testing if an error will be thrown in a test

  it('cannot provide a topic with more than 50 characters', async () => {  
    try { //try to see if the program will work, which it shouldn't
      const tweet = anchor.web3.Keypair.generate();
      const topicWith51Chars = 'x'.repeat(51);
      await program.rpc.sendTweet(topicWith51Chars, 'Hummus, am I right?', {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [
          tweet
        ],
      });
    } catch(error) { //when program doesn't work, test is good
      assert.equal(error.msg, 'The provided topic should be 50 characters long maximum.');
      return;
    }
                    //when program does work, test is bad
    assert.fail('The instruction should have failed with a 51-character topic.')
  });
  
  it('cannot provide a content with more than 280 characters', async () => {  
    try { //try to see if the program will work, which it shouldn't
      const tweet = anchor.web3.Keypair.generate();
      const contentWith281Chars = 'x'.repeat(281);
      await program.rpc.sendTweet('veganism', contentWith281Chars, {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [
          tweet
        ],
      });
    } catch(error) { //when program doesn't work, test is good
      assert.equal(error.msg, 'The provided content should be 280 characters long maximum.');
      return;
    }
                    //when program does work, test is bad
    assert.fail('The instruction should have failed with a 281-character content.')
  });

  //should only have 3, based off previous code
  //creates 5, 2 shouldn't be created
  it('can fetch all tweets', async () => {
    const tweetAccounts = await program.account.tweet.all();

    assert.equal(tweetAccounts.length, 3)
  })

  //using filter by author
  it('can filter tweets by author', async () => {
    const authorPublicKey = program.provider.wallet.publicKey
    //using the memcmp filter, takes the exact value from a specific byte position, returns matches
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8, //Discriminator
          bytes: authorPublicKey.toBase58(),
        }
      }
    ]);

    assert.equal(tweetAccounts.length, 2)
    //checks to see if tweetAccounts exist within our wallet
    
    //when using fetch() it gives back parsed data of tweet account
    //when using all() we get the same object but inside a wrapper object that also provides its public key
    assert.ok(tweetAccounts.every(tweetAccount => {
      return tweetAccount.account.author.toBase58() === authorPublicKey.toBase58()
    }))
  })

  //using filter by topic
    it('can filter tweets by topic', async () => {
    //using the memcmp filter, takes the exact value from a specific byte position, returns matches
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8 + //Descriminator.
            32 +  //Author public key.  
            8 +   //Timestamp.
            4,    //Topic string prefix.
          //must translate from string to buffer, then encode in base 58
          bytes: bs58.encode(Buffer.from('veganism')), //TODO
        }
      }
    ]);

    assert.equal(tweetAccounts.length, 2)
    //checks to see if tweetAccounts.topic exist within our wallet
    
    //when using fetch() it gives back parsed data of tweet account
    //when using all() we get the same object but inside a wrapper object that also provides its public key
    assert.ok(tweetAccounts.every(tweetAccount => {
      return tweetAccount.account.topic === 'veganism'
    }))
  })

  });
